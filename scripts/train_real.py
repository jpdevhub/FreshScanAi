"""Train fish species classifier on real Kaggle data + synthetic fallback."""
import os, sys, torch, torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms, models
from pathlib import Path
from PIL import Image
import time

DATA_DIR = Path(__file__).parent.parent / "data" / "real_fish"
SYNTHETIC_DIR = Path(__file__).parent.parent / "data" / "synthetic_fish"
MODEL_OUT = Path(__file__).parent.parent / "Models"

# All 10 species
ALL_SPECIES = [
    "rohu_carp", "catla_carp", "mrigal_carp", "pangas", "basa",
    "tilapia", "pomfret", "kingfish", "mackerel", "sardine",
]

# Species we have real images for
REAL_SPECIES = ["rohu_carp", "catla_carp", "mrigal_carp", "tilapia", "pomfret"]
SYNTHETIC_ONLY = ["pangas", "basa", "kingfish", "mackerel", "sardine"]


class FishDataset(Dataset):
    def __init__(self, root_dir, species_list, transform=None):
        self.files = []
        self.labels = []
        self.transform = transform
        self.species_to_idx = {s: i for i, s in enumerate(species_list)}

        for sp in species_list:
            sp_dir = root_dir / sp
            if not sp_dir.exists():
                continue
            for f in sp_dir.iterdir():
                if f.suffix.lower() in ('.jpg', '.jpeg', '.png', '.bmp'):
                    self.files.append(f)
                    self.labels.append(self.species_to_idx[sp])

    def __len__(self):
        return len(self.files)

    def __getitem__(self, idx):
        img = Image.open(self.files[idx]).convert('RGB')
        label = self.labels[idx]
        if self.transform:
            img = self.transform(img)
        return img, label


def train():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    if device.type == "cuda":
        print(f"GPU: {torch.cuda.get_device_name(0)}")

    # Transforms
    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.2, contrast=0.2),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    # Load real data
    print("\nLoading real fish images...")
    real_dataset = FishDataset(DATA_DIR, REAL_SPECIES, train_transform)
    print(f"  Real images: {len(real_dataset)}")

    # Load synthetic data for missing species (if available)
    synth_dataset = FishDataset(SYNTHETIC_DIR, SYNTHETIC_ONLY, train_transform)
    print(f"  Synthetic images: {len(synth_dataset)}")

    # Combine
    from torch.utils.data import ConcatDataset
    if len(synth_dataset) > 0:
        combined = ConcatDataset([real_dataset, synth_dataset])
    else:
        combined = real_dataset
        print("  (Using real data only - no synthetic data found)")

    # Split 80/20
    total = len(combined)
    train_size = int(0.8 * total)
    val_size = total - train_size
    train_dataset, val_dataset = torch.utils.data.random_split(
        combined, [train_size, val_size]
    )

    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False, num_workers=0)

    print(f"  Train: {train_size}, Val: {val_size}")

    # Model: MobileNetV3-Small
    print("\nBuilding MobileNetV3-Small...")
    model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
    model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, 10)
    model = model.to(device)

    # Freeze early layers, fine-tune last layers
    for param in model.features[:7].parameters():
        param.requires_grad = False

    optimizer = torch.optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=1e-3, weight_decay=0.01
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=20)
    criterion = nn.CrossEntropyLoss()

    # Training loop
    epochs = 20
    best_acc = 0.0
    print(f"\nTraining for {epochs} epochs...")
    start = time.time()

    for epoch in range(epochs):
        # Train
        model.train()
        train_loss = 0.0
        train_correct = 0
        train_total = 0
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * images.size(0)
            _, predicted = outputs.max(1)
            train_correct += predicted.eq(labels).sum().item()
            train_total += labels.size(0)

        # Validate
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                loss = criterion(outputs, labels)
                val_loss += loss.item() * images.size(0)
                _, predicted = outputs.max(1)
                val_correct += predicted.eq(labels).sum().item()
                val_total += labels.size(0)

        scheduler.step()

        train_acc = 100.0 * train_correct / train_total
        val_acc = 100.0 * val_correct / val_total
        print(f"  Epoch {epoch+1}/{epochs}: "
              f"train_loss={train_loss/train_total:.4f} "
              f"train_acc={train_acc:.1f}% "
              f"val_loss={val_loss/val_total:.4f} "
              f"val_acc={val_acc:.1f}%")

        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), MODEL_OUT / "species_mobilenetv3.pth")
            print(f"    -> Saved best model (val_acc={val_acc:.1f}%)")

    elapsed = time.time() - start
    print(f"\nDone in {elapsed:.1f}s. Best val accuracy: {best_acc:.1f}%")
    print(f"Model saved to: {MODEL_OUT / 'species_mobilenetv3.pth'}")


if __name__ == "__main__":
    train()
