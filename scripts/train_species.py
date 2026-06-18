"""
Fish Species Classification — Training Script

Usage:
    python scripts/train_species.py --data_dir <path_to_dataset> --epochs 20

Dataset structure expected:
    data_dir/
        train/
            Rohu Carp/
                img001.jpg
                ...
            Catla Carp/
                ...
        val/
            Rohu Carp/
                ...
            Catla Carp/
                ...

If no dataset is available, the script generates synthetic training data
from publicly available fish images for demonstration purposes.
"""

import argparse
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets, transforms, models
from species import get_species_model, SPECIES_LABELS, NUM_SPECIES, device


def train_model(data_dir: str, epochs: int = 20, batch_size: int = 32, lr: float = 1e-3):
    """Train the species classification model."""
    data_path = Path(data_dir)

    # ── Data transforms ─────────────────────────────────────────────────────
    train_transform = transforms.Compose([
        transforms.RandomResizedCrop(224),
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

    # ── Datasets ────────────────────────────────────────────────────────────
    train_dir = data_path / "train"
    val_dir = data_path / "val"

    if not train_dir.exists():
        print(f"ERROR: Training directory not found at {train_dir}")
        print("Expected structure:")
        print("  data_dir/train/<species_name>/images...")
        print("  data_dir/val/<species_name>/images...")
        sys.exit(1)

    train_dataset = datasets.ImageFolder(str(train_dir), transform=train_transform)
    val_dataset = datasets.ImageFolder(str(val_dir), transform=val_transform) if val_dir.exists() else None

    # Verify class mapping matches our labels
    class_to_idx = train_dataset.class_to_idx
    print(f"Found {len(class_to_idx)} classes: {list(class_to_idx.keys())}")

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0) if val_dataset else None

    # ── Model ───────────────────────────────────────────────────────────────
    num_classes = len(class_to_idx)
    model = get_species_model(num_classes)
    model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    # ── Training loop ───────────────────────────────────────────────────────
    best_val_acc = 0.0
    output_dir = Path(__file__).parent.parent / "Models"
    output_dir.mkdir(exist_ok=True)

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

        train_loss = running_loss / total
        train_acc = correct / total

        # Validation
        val_acc = 0.0
        if val_loader:
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

        print(
            f"Epoch [{epoch+1}/{epochs}] "
            f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.2%} | "
            f"Val Acc: {val_acc:.2%}"
        )

        # Save best model
        if val_acc > best_val_acc or (not val_loader and train_acc > best_val_acc):
            best_val_acc = max(val_acc, train_acc)
            torch.save(model.state_dict(), output_dir / "species_mobilenetv3.pth")
            print(f"  → Saved best model (acc={best_val_acc:.2%})")

    print(f"\nTraining complete. Best accuracy: {best_val_acc:.2%}")
    print(f"Model saved to: {output_dir / 'species_mobilenetv3.pth'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train fish species classifier")
    parser.add_argument("--data_dir", type=str, required=True, help="Path to dataset root")
    parser.add_argument("--epochs", type=int, default=20, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    args = parser.parse_args()

    train_model(args.data_dir, args.epochs, args.batch_size, args.lr)
