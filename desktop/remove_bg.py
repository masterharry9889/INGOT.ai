import sys
from PIL import Image

def process():
    input_path = r'd:\INGOT.ai\frontend\logo\21b08db87f66fdbe20e5f52fa9ddb93f.webp'
    
    input_img = Image.open(input_path).convert("RGBA")
    data = input_img.getdata()
    new_data = []
    # Using a slightly aggressive threshold for near-white
    for item in data:
        # Check if pixel is close to white
        if item[0] > 230 and item[1] > 230 and item[2] > 230:
            new_data.append((255, 255, 255, 0)) # Transparent
        else:
            new_data.append(item)
    
    input_img.putdata(new_data)
    output_img = input_img

    # Overwrite the original
    output_img.save(input_path, format="WEBP")
    print("Original webp updated.")
    
    # Update public logo
    output_img.save(r'd:\INGOT.ai\frontend\public\logo.webp', format="WEBP")
    
    # Regenerate ICO
    icon_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    output_img.save(r'd:\INGOT.ai\desktop\icon.ico', format='ICO', sizes=icon_sizes)
    
    # Regenerate PNGs
    img_large = output_img.resize((512, 512), Image.Resampling.LANCZOS)
    img_large.save(r'd:\INGOT.ai\desktop\build\icon.png', format='PNG')
    img_large.save(r'd:\INGOT.ai\frontend\app\icon.png', format='PNG')
    
    print("All icons regenerated with transparent background.")

if __name__ == '__main__':
    process()
