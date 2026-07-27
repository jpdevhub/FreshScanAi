"""
Generate a real trained species_mobilenetv3.pth using synthetic data.
This produces a valid model checkpoint that matches the expected architecture.
After generating, you can retrain on real data later.

Usage: python scripts\train_synthetic.py
"""
import sys
from pathlib import Path
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from torchvision import models
import numpy as np

SPECIES_LABELS = [
    "Rohu Carp", "Catla Carp", "Mrigal Carp", "Pangas", "Basa",
    "Tilapia", "Pomfret", "Kingfish", "Mackerel", "Sardine",
]
NUM_SPECIES = len(SPECIES_LABELS)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def get_species_model(num_classes=NUM_SPECIES):
    model = models.mobilenet_v3_small(weights=None)
    in_features = model.classifier[0].in_features
    model.classifier = nn.Sequential(
        nn.Linear(in_features, 256),
        nn.Hardswish(inplace=True),
        nn.Dropout(p=0.2),
        nn.Linear(256, num_classes),
    )
    return model


def generate_synthetic_samples(n_per_class=80, img_size=224):
    species_colors = [
        (180, 60, 60), (60, 120, 180), (60, 160, 80), (200, 180, 60), (160, 100, 60),
        (100, 180, 160), (200, 140, 180), (60, 60, 180), (180, 140, 60), (120, 120, 140),
    ]
    all_images, all_labels = [], []
    for cls_idx, base_color in enumerate(species_colors):
        for _ in range(n_per_class):
            arr = np.random.randint(0, 50, (img_size, img_size, 3), dtype=np.uint8)
            cx, cy = img_size // 2, img_size // 2
            r = img_size // 4
            y_grid, x_grid = np.ogrid[:img_size, :img_size]
            mask = (x_grid - cx) ** 2 + (y_grid - cy) ** 2 < r ** 2
            for c in range(3):
                arr[:, :, c][mask] = np.clip(
                    base_color[c] + np.random.randint(-20, 20, arr[:, :, c][mask].shape, dtype=np.int16),
                    0, 255
                ).astype(np.uint8)
            all_images.append(arr)
            all_labels.append(cls_idx)
    images = np.array(all_images, dtype=np.float32).transpose(0, 3, 1, 2) / 255.0
    mean = np.array([0.485, 0.456, 0.406]).reshape(1, 3, 1, 1)
    std = np.array([0.229, 0.224, 0.225]).reshape(1, 3, 1, 1)
    images = (images - mean) / std
    return torch.tensor(images, dtype=torch.float32), torch.tensor(np.array(all_labels, dtype=np.int64))


def train():
    print(f"Device: {device}")
    print(f"Species: {SPECIES_LABELS}")
    print(f"Num classes: {NUM_SPECIES}")

    print("\nGenerating synthetic training data...")
    X, y = generate_synthetic_samples(n_per_class=80)
    print(f"  Samples: {X.shape[0]} images ({NUM_SPECIES} classes x 80)")

    n = len(X)
    n_train = int(0.8 * n)
    indices = torch.randperm(n)
    train_ds = TensorDataset(X[indices[:n_train]], y[indices[:n_train]])
    val_ds = TensorDataset(X[indices[n_train:]], y[indices[n_train:]])
    train_loader = DataLoader(train_ds, batch_size=16, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=16, shuffle=False)

    model = get_species_model(NUM_SPECIES).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=15)

    output_dir = Path(__file__).parent.parent / "Models"
    output_dir.mkdir(exist_ok=True)

    epochs = 15
    best_val_acc = 0.0

    print(f"\nTraining for {epochs} epochs...")
    for epoch in range(epochs):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * images.size(0)
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()
        train_acc = correct / total
        train_loss = running_loss / total

        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                _, predicted = outputs.max(1)
                val_total += labels.size(0)
                val_correct += predicted.eq(labels).sum().item()
        val_acc = val_correct / val_total if val_total > 0 else 0.0
        scheduler.step()

        marker = ""
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), output_dir / "species_mobilenetv3.pth")
            marker = " *SAVED*"
        print(f"  Epoch [{epoch+1}/{epochs}] Loss: {train_loss:.4f} Train: {train_acc:.2%} Val: {val_acc:.2%}{marker}")

    final_path = output_dir / "species_mobilenetv3.pth"
    torch.save(model.state_dict(), final_path)
    size_mb = final_path.stat().st_size / (1024 * 1024)
    print(f"\nDone! Best val accuracy: {best_val_acc:.2%}")
    print(f"Model saved: {final_path} ({size_mb:.1f} MB)")

    model.eval()
    with torch.no_grad():
        test_img = X[0:1].to(device)
        logits = model(test_img)
        probs = torch.softmax(logits, dim=1)
        top5 = torch.topk(probs, 5)
        print("\nInference test:")
        for i in range(5):
            idx = top5.indices[0][i].item()
            prob = top5.values[0][i].item()
            print(f"  {SPECIES_LABELS[idx]}: {prob:.2%}")


if __name__ == "__main__":
    train()
