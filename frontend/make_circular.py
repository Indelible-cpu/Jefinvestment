import os
from PIL import Image, ImageDraw

def make_circular(img_path):
    print(f"Processing {img_path}...")
    try:
        img = Image.open(img_path).convert("RGBA")
    except Exception as e:
        print(f"Failed to open {img_path}: {e}")
        return

    # Create a circular mask
    mask = Image.new("L", img.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, img.size[0], img.size[1]), fill=255)

    # Apply the mask
    circular_img = Image.new("RGBA", img.size, (0, 0, 0, 0))
    circular_img.paste(img, (0, 0), mask)

    # Overwrite the original file
    circular_img.save(img_path, "PNG")
    print(f"Saved {img_path}")

public_dir = r"C:\Jef Investment\frontend\public"
files_to_process = ["favicon.png", "pwa-192x192.png", "pwa-512x512.png"]

for filename in files_to_process:
    full_path = os.path.join(public_dir, filename)
    if os.path.exists(full_path):
        make_circular(full_path)
    else:
        print(f"{full_path} does not exist.")
