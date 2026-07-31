"""Prepare official Aɪra brand icon + favicon size set from the uploaded symbol."""
from PIL import Image
import os
import shutil

SRC = os.path.join(
    os.environ["APPDATA"],
    r"Cursor\User\workspaceStorage\empty-window\images",
)

# Prefer newest EdTech logo upload
candidates = sorted(
    [f for f in os.listdir(SRC) if f.lower().startswith("edtech") and f.lower().endswith(".png")],
    key=lambda n: os.path.getmtime(os.path.join(SRC, n)),
    reverse=True,
)
if not candidates:
    raise SystemExit("No EdTech logo source found")

src_path = os.path.join(SRC, candidates[0])
print("Source:", src_path)

brand_dir = os.path.join("public", "brand")
icons_dir = os.path.join(brand_dir, "icons")
os.makedirs(icons_dir, exist_ok=True)


def remove_near_black(im: Image.Image, threshold=30, soft=20) -> Image.Image:
    im = im.convert("RGBA")
    pixels = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
            if lum <= threshold:
                pixels[x, y] = (r, g, b, 0)
            elif lum < threshold + soft:
                t = (lum - threshold) / soft
                pixels[x, y] = (r, g, b, int(a * t))
    return im


def to_square(im: Image.Image, pad_ratio=0.04) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    pad = max(4, int(min(im.size) * pad_ratio))
    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(im.size[0], bbox[2] + pad)
    bottom = min(im.size[1], bbox[3] + pad)
    cropped = im.crop((left, top, right, bottom))
    side = max(cropped.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - cropped.size[0]) // 2
    oy = (side - cropped.size[1]) // 2
    canvas.paste(cropped, (ox, oy), cropped)
    return canvas


def resize_rgba(im: Image.Image, size: int) -> Image.Image:
    return im.resize((size, size), Image.Resampling.LANCZOS)


raw = Image.open(src_path)
icon = to_square(remove_near_black(raw))
master = resize_rgba(icon, 512)
master_path = os.path.join(brand_dir, "aira-icon.png")
master.save(master_path, "PNG", optimize=True)
print("Wrote", master_path, master.size)

# Also keep under /logos for the header animation
logos_dir = os.path.join("public", "logos")
os.makedirs(logos_dir, exist_ok=True)
logo_icon = os.path.join(logos_dir, "aira-brand-icon.png")
master.save(logo_icon, "PNG", optimize=True)

# Remove legacy graduation-cap transition assets if present
for legacy in ("aira-logo-a.png", "aira-logo-b.png"):
    p = os.path.join(logos_dir, legacy)
    if os.path.exists(p):
        os.remove(p)
        print("Removed", p)

sizes = [16, 32, 48, 64, 180, 192, 512]
for s in sizes:
    out = os.path.join(icons_dir, f"icon-{s}x{s}.png")
    resize_rgba(icon, s).save(out, "PNG", optimize=True)
    print("Wrote", out)

# Multi-size .ico for the implicit /favicon.ico request browsers make regardless of <link>
icon.save(os.path.join("public", "favicon.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

# Convenience copies used by Next metadata / PWA conventions
shutil.copyfile(os.path.join(icons_dir, "icon-32x32.png"), os.path.join("public", "favicon-32x32.png"))
shutil.copyfile(os.path.join(icons_dir, "icon-16x16.png"), os.path.join("public", "favicon-16x16.png"))
shutil.copyfile(os.path.join(icons_dir, "icon-180x180.png"), os.path.join("public", "apple-icon.png"))
shutil.copyfile(os.path.join(icons_dir, "icon-192x192.png"), os.path.join("public", "icon-192.png"))
shutil.copyfile(os.path.join(icons_dir, "icon-512x512.png"), os.path.join("public", "icon-512.png"))
# Primary favicon path used historically
shutil.copyfile(os.path.join(icons_dir, "icon-32x32.png"), os.path.join("public", "aira-favicon.png"))
shutil.copyfile(os.path.join(icons_dir, "icon-32x32.png"), os.path.join("public", "icon-light-32x32.png"))
shutil.copyfile(os.path.join(icons_dir, "icon-32x32.png"), os.path.join("public", "icon-dark-32x32.png"))

print("done")
