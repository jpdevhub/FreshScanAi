"""Fix: use correct crowww path + .png extension, then train 9-species model."""
import os, shutil, sys
from pathlib import Path

BASE = Path(__file__).parent.parent
CROWWW = BASE / "data" / "kaggle_fish" / "crowww_large_fish" / "Fish_Dataset" / "Fish_Dataset"
REAL_FISH = BASE / "data" / "real_fish"
SYNTH_FISH = BASE / "data" / "synthetic_fish"

# Map crowww species -> our species
MAPPING = {
    "Hourse Mackerel": "mackerel",
    "Black Sea Sprat": "sardine",
}

def step1_fix_crowww():
    """Copy real crowww images into our species folders."""
    print("=" * 60)
    print("STEP 1: Copy crowww images to replace synthetic")
    print("=" * 60)

    for crowww_name, our_species in MAPPING.items():
        # Images are inside nested dir: Hourse Mackerel/Hourse Mackerel/00001.png
        src_dir = CROWWW / crowww_name / crowww_name
        dst_dir = REAL_FISH / our_species
        if not src_dir.exists():
            print(f"  SKIP: {src_dir} not found")
            continue

        dst_dir.mkdir(parents=True, exist_ok=True)

        # Remove old synthetic
        synth_dir = SYNTH_FISH / our_species
        if synth_dir.exists():
            count = len(list(synth_dir.glob("*")))
            shutil.rmtree(synth_dir)
            print(f"  Removed {count} synthetic images for {our_species}")

        # Copy real images (.png extension!)
        imgs = sorted(src_dir.glob("*.png"))
        existing = len(list(dst_dir.glob("*")))
        copied = 0
        for img in imgs[:200]:
            dst = dst_dir / f"crowww_{copied:04d}.png"
            if not dst.exists():
                shutil.copy2(img, dst)
                copied += 1
        print(f"  {crowww_name} -> {our_species}: +{copied} real images (total: {existing + copied})")


def step2_train_9species():
    """Train 9-species model on full crowww dataset."""
    print("\n" + "=" * 60)
    print("STEP 2: Train 9-species model on crowww dataset")
    print("=" * 60)

    import torch, torch.nn as nn, time
    from torch.utils.data import DataLoader, Dataset, random_split
    from torchvision import transforms, models
    from PIL import Image

    SPECIES = [
        "Black Sea Sprat", "Gilt-Head Bream", "Hourse Mackerel",
        "Red Mullet", "Red Sea Bream", "Sea Bass", "Shrimp",
        "Striped Red Mullet", "Trout",
    ]

    class CrowwwDataset(Dataset):
        def __init__(self, root_dir, species_list, transform=None):
            self.files, self.labels = [], []
            self.transform = transform
            self.species_to_idx = {s: i for i, s in enumerate(species_list)}
            for sp in species_list:
                # Nested: species/species/*.png
                sp_dir = root_dir / sp / sp
                if not sp_dir.exists():
                    print(f"  WARNING: {sp_dir} not found")
                    continue
                count = 0
                for f in sp_dir.iterdir():
                    if f.suffix.lower() in ('.png', '.jpg', '.jpeg', '.bmp'):
                        self.files.append(f)
                        self.labels.append(self.species_to_idx[sp])
                        count += 1
                print(f"  {sp}: {count} images")

        def __len__(self):
            return len(self.files)

        def __getitem__(self, idx):
            img = Image.open(self.files[idx]).convert('RGB')
            if self.transform:
                img = self.transform(img)
            return img, self.labels[idx]

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(10),
        transforms.ColorJitter(brightness=0.2, contrast=0.2),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    dataset = CrowwwDataset(CROWWW, SPECIES, transform)
    print(f"\nTotal images: {len(dataset)}")

    if len(dataset) == 0:
        print("ERROR: No images found!")
        return

    train_size = int(0.85 * len(dataset))
    val_size = len(dataset) - train_size
    train_ds, val_ds = random_split(dataset, [train_size, val_size])
    train_loader = DataLoader(train_ds, batch_size=64, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=64, shuffle=False, num_workers=0)
    print(f"Train: {train_size}, Val: {val_size}")

    model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
    model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, 9)
    model = model.to(device)

    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=0.01)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=15)
    criterion = nn.CrossEntropyLoss()

    best_acc = 0.0
    print(f"\nTraining for 15 epochs...")
    start = time.time()
    for epoch in range(15):
        model.train()
        train_correct = train_total = 0
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer.zero_grad()
            out = model(imgs)
            loss = criterion(out, labels)
            loss.backward()
            optimizer.step()
            _, pred = out.max(1)
            train_correct += pred.eq(labels).sum().item()
            train_total += labels.size(0)

        model.eval()
        val_correct = val_total = 0
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(device), labels.to(device)
                out = model(imgs)
                _, pred = out.max(1)
                val_correct += pred.eq(labels).sum().item()
                val_total += labels.size(0)
        scheduler.step()

        val_acc = 100.0 * val_correct / val_total
        print(f"  Epoch {epoch+1}: train={100*train_correct/train_total:.1f}% val={val_acc:.1f}%")
        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), BASE / "Models" / "crowww_9species.pth")
            print(f"    -> Saved (best={val_acc:.1f}%)")

    print(f"\nDone in {time.time()-start:.0f}s. Best: {best_acc:.1f}%")


if __name__ == "__main__":
    step1_fix_crowww()
    step2_train_9species()
