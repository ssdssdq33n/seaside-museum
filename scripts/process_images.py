#!/usr/bin/env python3
"""
Optimize gallery photos for the web 3D museum.

Reads originals from  images/
Writes optimized web + thumbnail images to  public/art/
Writes a manifest to  src/data/photos.json

Run:  python scripts/process_images.py
"""
import glob
import json
import os
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "images")
WEB_DIR = os.path.join(ROOT, "public", "art", "web")
FULL_DIR = os.path.join(ROOT, "public", "art", "full")
ORIG_DIR = os.path.join(ROOT, "public", "art", "orig")
THUMB_DIR = os.path.join(ROOT, "public", "art", "thumb")
MANIFEST = os.path.join(ROOT, "src", "data", "photos.json")

WEB_LONG_EDGE = 2560      # crisp version shown on the wall (GPU texture)
FULL_LONG_EDGE = 4096     # streamed on focus (GPU texture)
ORIG_LONG_EDGE = None     # original resolution, shown in the zoom lightbox (DOM img)
THUMB_LONG_EDGE = 32      # tiny placeholder / loading colour
WEB_QUALITY = 92
FULL_QUALITY = 94
ORIG_QUALITY = 90
THUMB_QUALITY = 60


def avg_color(im):
    small = im.convert("RGB").resize((1, 1))
    r, g, b = small.getpixel((0, 0))
    return "#%02x%02x%02x" % (r, g, b)


def process():
    os.makedirs(WEB_DIR, exist_ok=True)
    os.makedirs(FULL_DIR, exist_ok=True)
    os.makedirs(ORIG_DIR, exist_ok=True)
    os.makedirs(THUMB_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)

    files = sorted(
        f for f in glob.glob(os.path.join(SRC_DIR, "*"))
        if f.lower().endswith((".jpg", ".jpeg", ".png"))
    )
    photos = []
    for i, path in enumerate(files):
        name = os.path.splitext(os.path.basename(path))[0]
        im = Image.open(path)
        im = ImageOps.exif_transpose(im).convert("RGB")
        w, h = im.size
        ratio = round(w / h, 4)
        orientation = "landscape" if w >= h else "portrait"

        # web version (shown on the wall)
        web = im.copy()
        web.thumbnail((WEB_LONG_EDGE, WEB_LONG_EDGE), Image.LANCZOS)
        web_path = os.path.join(WEB_DIR, name + ".jpg")
        web.save(web_path, "JPEG", quality=WEB_QUALITY, optimize=True, progressive=True)

        # full version (used on focus, GPU texture)
        full = im.copy()
        full.thumbnail((FULL_LONG_EDGE, FULL_LONG_EDGE), Image.LANCZOS)
        full_path = os.path.join(FULL_DIR, name + ".jpg")
        full.save(full_path, "JPEG", quality=FULL_QUALITY, optimize=True, progressive=True)

        # original resolution (zoom lightbox)
        orig_path = os.path.join(ORIG_DIR, name + ".jpg")
        im.save(orig_path, "JPEG", quality=ORIG_QUALITY, optimize=True, progressive=True)

        # tiny placeholder
        thumb = im.copy()
        thumb.thumbnail((THUMB_LONG_EDGE, THUMB_LONG_EDGE), Image.LANCZOS)
        thumb_path = os.path.join(THUMB_DIR, name + ".jpg")
        thumb.save(thumb_path, "JPEG", quality=THUMB_QUALITY, optimize=True)

        color = avg_color(thumb)
        photos.append({
            "id": name,
            "index": i,
            "web": f"art/web/{name}.jpg",
            "full": f"art/full/{name}.jpg",
            "orig": f"art/orig/{name}.jpg",
            "thumb": f"art/thumb/{name}.jpg",
            "width": web.size[0],
            "height": web.size[1],
            "ratio": round(web.size[0] / web.size[1], 4),
            "orientation": orientation,
            "color": color,
            "title": "",
            "caption": "",
        })
        print(f"[{i+1:2d}/{len(files)}] {name}  {w}x{h} {orientation}  web={web.size[0]}x{web.size[1]} ({os.path.getsize(web_path)//1024}KB)  full={full.size[0]}x{full.size[1]} ({os.path.getsize(full_path)//1024}KB)")

    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump({"photos": photos}, f, ensure_ascii=False, indent=2)
    print(f"\nWrote {len(photos)} photos -> {os.path.relpath(MANIFEST, ROOT)}")


if __name__ == "__main__":
    process()
