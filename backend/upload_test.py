import os
import tkinter as tk
from tkinter import filedialog
from PIL import Image

# Change current working directory to backend so imports work
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from inference import load_models, predict_stream_a, predict_stream_b
from fusion import apply_temperature_scaling

def run_upload_test():
    # Hide the main tkinter window
    root = tk.Tk()
    root.withdraw()
    
    # Force window to top
    root.attributes('-topmost', True)

    print("Opening file dialog... Please select an image file to test.")
    file_path = filedialog.askopenfilename(
        title="Select an Image for FreshScan AI",
        filetypes=[("Image Files", "*.png;*.jpg;*.jpeg;*.bmp")]
    )

    if not file_path:
        print("No image selected. Exiting.")
        return

    print(f"\nSelected Image: {file_path}")
    print("Loading PyTorch Models...")

    # Load models
    stream_a_path = r"c:\Users\Abhi\Desktop\Bugs\Models\freshscan_stream_a_body.pth"
    stream_b_path = r"c:\Users\Abhi\Desktop\Bugs\Models\stream_b_checkpoint.pth"

    try:
        load_models(stream_a_path, stream_b_path)
    except Exception as e:
        print(f"Error loading models: {e}")
        return

    # Load image
    try:
        image = Image.open(file_path).convert("RGB")
    except Exception as e:
        print(f"Error opening image: {e}")
        return

    print("Running Inference...")
    
    # Pass the SAME image through both models to see what they output
    try:
        logits_a = predict_stream_a(image)
        logits_b = predict_stream_b(image)
        
        # Get calibrated probabilities
        probs_a = apply_temperature_scaling(logits_a).tolist()
        probs_b = apply_temperature_scaling(logits_b).tolist()

        print("\n=======================================================")
        print("   STREAM A OUTPUT (MobileNet Body Classifier - 224x224) ")
        print("=======================================================")
        print(f"Raw Logits: {logits_a.tolist()}")
        print("Calibrated Probabilities:")
        print(f" -> C1 (Fresh)   : {probs_a[0]:.2%}")
        print(f" -> C2 (Moderate): {probs_a[1]:.2%}")
        print(f" -> C3 (Spoiled) : {probs_a[2]:.2%}")

        print("\n=======================================================")
        print("   STREAM B OUTPUT (Biomarker CNN - 64x64)             ")
        print("=======================================================")
        print(f"Raw Logits: {logits_b.tolist()}")
        print("Calibrated Probabilities:")
        print(f" -> Fresh Eyes     : {probs_b[0]:.2%}")
        print(f" -> Fresh Gills    : {probs_b[1]:.2%}")
        print(f" -> Nonfresh Eyes  : {probs_b[2]:.2%}")
        print(f" -> Nonfresh Gills : {probs_b[3]:.2%}")
        print("=======================================================\n")
        
        print("Note: Stream B expects tight crops of the eye/gill for maximum accuracy.")

    except Exception as e:
        print(f"Inference failed: {e}")

if __name__ == '__main__':
    run_upload_test()
