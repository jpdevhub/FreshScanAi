import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image

# Setup Device
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# --- Stream A Architecture (Body) ---
def get_stream_a_model():
    # Load base MobileNetV2 without pre-trained weights (we will load our own state_dict)
    model = models.mobilenet_v2(weights=None)
    num_ftrs = model.classifier[1].in_features
    # Modify classifier to match the 3 classes trained (C1, C2, C3)
    model.classifier[1] = nn.Linear(num_ftrs, 3)
    return model

# --- Stream B Architecture (Biomarker) ---
class BiomarkerCNN(nn.Module):
    def __init__(self):
        super(BiomarkerCNN, self).__init__()
        # Input: 3 channels (RGB), 64x64 image
        self.conv1 = nn.Conv2d(3, 16, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(16)
        self.pool1 = nn.MaxPool2d(2, 2) # Output: 16 x 32 x 32

        self.conv2 = nn.Conv2d(16, 32, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(32)
        self.pool2 = nn.MaxPool2d(2, 2) # Output: 32 x 16 x 16

        self.conv3 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm2d(64)
        self.pool3 = nn.MaxPool2d(2, 2) # Output: 64 x 8 x 8

        self.fc1 = nn.Linear(64 * 8 * 8, 128)
        self.dropout = nn.Dropout(0.5)
        self.fc2 = nn.Linear(128, 4) # 4 output classes: FE, FG, NFE, NFG

    def forward(self, x):
        x = self.pool1(F.relu(self.bn1(self.conv1(x))))
        x = self.pool2(F.relu(self.bn2(self.conv2(x))))
        x = self.pool3(F.relu(self.bn3(self.conv3(x))))

        x = x.view(-1, 64 * 8 * 8)
        x = F.relu(self.fc1(x))
        x = self.dropout(x)
        x = self.fc2(x)
        return x

# --- Global Model References ---
stream_a_model = None
stream_b_model = None

# --- Preprocessing Pipelines ---
# Extracted base torchvision normalization
common_normalize = transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])

stream_a_transforms = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    common_normalize
])

stream_b_transforms = transforms.Compose([
    transforms.Resize((64, 64)),
    transforms.ToTensor(),
    common_normalize
])

# --- Initialization / Loading ---
def load_models(stream_a_path: str, stream_b_path: str):
    """
    Initializes models and loads pre-trained weights into memory.
    Run this once on server startup.
    """
    global stream_a_model, stream_b_model
    
    # Load Stream A (Body)
    stream_a_model = get_stream_a_model()
    stream_a_model.load_state_dict(torch.load(stream_a_path, map_location=device, weights_only=True))
    stream_a_model.to(device)
    stream_a_model.eval()

    # Load Stream B (Biomarker - Eyes/Gills)
    stream_b_model = BiomarkerCNN()
    checkpoint_b = torch.load(stream_b_path, map_location=device, weights_only=False)
    
    # Check if this is a full checkpoint dictionary or just a state_dict
    if isinstance(checkpoint_b, dict) and 'model_state_dict' in checkpoint_b:
        stream_b_model.load_state_dict(checkpoint_b['model_state_dict'])
    else:
        stream_b_model.load_state_dict(checkpoint_b)
        
    stream_b_model.to(device)
    stream_b_model.eval()
    
# --- Forward Pass Inference ---
@torch.no_grad()
def predict_stream_a(image: Image.Image):
    """Returns raw logits for Stream A (Global Body) [C1, C2, C3]"""
    tensor = stream_a_transforms(image).unsqueeze(0).to(device)
    logits = stream_a_model(tensor)
    return logits.squeeze(0).cpu().numpy()

@torch.no_grad()
def predict_stream_b(image: Image.Image):
    """Returns raw logits for Stream B (Micro-crops) [Fresh_Eyes, Fresh_Gills, Nonfresh_Eyes, Nonfresh_Gills]"""
    tensor = stream_b_transforms(image).unsqueeze(0).to(device)
    logits = stream_b_model(tensor)
    return logits.squeeze(0).cpu().numpy()

# --- Module Specific Wrappers ---

def scan_whole_body(image: Image.Image) -> dict:
    from fusion import apply_temperature_scaling
    logits = predict_stream_a(image)
    probs = apply_temperature_scaling(logits).tolist()
    return {
        "C1_Fresh": probs[0],
        "C2_Moderate": probs[1],
        "C3_Spoiled": probs[2]
    }

def scan_eyes(image: Image.Image) -> dict:
    from fusion import apply_temperature_scaling
    logits = predict_stream_b(image)
    probs = apply_temperature_scaling(logits).tolist()
    total_eye = probs[0] + probs[2] if (probs[0] + probs[2]) > 0 else 1e-7
    return {
        "Fresh": probs[0] / total_eye,
        "Spoiled": probs[2] / total_eye
    }

def scan_gills(image: Image.Image) -> dict:
    from fusion import apply_temperature_scaling
    logits = predict_stream_b(image)
    probs = apply_temperature_scaling(logits).tolist()
    total_gill = probs[1] + probs[3] if (probs[1] + probs[3]) > 0 else 1e-7
    return {
        "Fresh": probs[1] / total_gill,
        "Spoiled": probs[3] / total_gill
    }

