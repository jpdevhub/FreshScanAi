import os
import tkinter as tk
from tkinter import filedialog
from PIL import Image

# Change current working directory to backend so imports work
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from router import classify_image_type, ImageType
from inference import load_models, scan_whole_body, scan_eyes, scan_gills

def run_auto_test():
    # Hide the main tkinter window
    root = tk.Tk()
    root.withdraw()
    
    # Force window to top
    root.attributes('-topmost', True)

    print("Opening file dialog... Please select ONE image to test out auto-routing.")
    file_path = filedialog.askopenfilename(
        title="Select an Image for FreshScan Auto-Detect",
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
        print(f"Error loading FreshScan models: {e}")
        return

    # Load image
    try:
        image = Image.open(file_path).convert("RGB")
    except Exception as e:
        print(f"Error opening image: {e}")
        return

    # Step 1: Detect Image Type automatically
    print("\n[ROUTER] Classifying image type via Zero-Shot AI...")
    try:
        image_type = classify_image_type(image)
        print(f"[ROUTER] Detected Image Type -> {image_type.value}")
    except Exception as e:
        print(f"[ROUTER] Failed to classify image: {e}")
        return

    # Early exit if not a fish image
    if image_type == ImageType.NOT_A_FISH:
        print("\n" + "=" * 40)
        print("   ❌  ERROR: NOT A FISH IMAGE")
        print("=" * 40)
        print("  The FreshScan AI system only accepts")
        print("  images of fish or fish body parts.")
        print("  Please upload a valid fish image.")
        print("=" * 40)
        return

    # Step 2: Route to appropriate specialized module
    print("\n[INFERENCE] Pushing image specifically to specialized module...")
    
    try:
        if image_type == ImageType.BODY:
            results = scan_whole_body(image)
            print("====================================")
            print("         WHOLE BODY REPORT          ")
            print("====================================")
            for k, v in results.items():
                print(f" -> {k:12}: {v:.2%}")
                
        elif image_type == ImageType.EYE:
            results = scan_eyes(image)
            print("====================================")
            print("           EYE REPORT               ")
            print("====================================")
            for k, v in results.items():
                print(f" -> {k:12}: {v:.2%}")
                
        elif image_type == ImageType.GILL:
            results = scan_gills(image)
            print("====================================")
            print("           GILL REPORT              ")
            print("====================================")
            for k, v in results.items():
                print(f" -> {k:12}: {v:.2%}")
                
        else:
            print("====================================")
            print("           UNKNOWN FORMAT           ")
            print("====================================")
            print("The router could not detect with high confidence whether this was a Body, Eye, or Gill.")
            print("Falling back to full Stream A processing as a safety default.")
            results = scan_whole_body(image)
            for k, v in results.items():
                print(f" -> {k:12}: {v:.2%}")
                
        print("====================================\n")

    except Exception as e:
        print(f"Inference failed: {e}")

if __name__ == '__main__':
    run_auto_test()
