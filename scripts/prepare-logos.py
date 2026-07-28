from PIL import Image
import os

src_a = r"public\aira-favicon.png"
src_b = r"public\logos\_logo-b-src.png"
out_dir = r"public\logos"
os.makedirs(out_dir, exist_ok=True)


def remove_near_black(path, out, threshold=28, soft=18):
    im = Image.open(path).convert("RGBA")
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

    bbox = im.getbbox()
    if bbox:
        pad = max(4, int(min(w, h) * 0.02))
        left = max(0, bbox[0] - pad)
        top = max(0, bbox[1] - pad)
        right = min(w, bbox[2] + pad)
        bottom = min(h, bbox[3] + pad)
        im = im.crop((left, top, right, bottom))

    side = max(im.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - im.size[0]) // 2
    oy = (side - im.size[1]) // 2
    canvas.paste(im, (ox, oy), im)
    if side > 512:
        canvas = canvas.resize((512, 512), Image.Resampling.LANCZOS)
    canvas.save(out, "PNG", optimize=True)
    print(f"Wrote {out} size={canvas.size}")


remove_near_black(src_a, os.path.join(out_dir, "aira-logo-a.png"), threshold=22, soft=14)
remove_near_black(src_b, os.path.join(out_dir, "aira-logo-b.png"), threshold=30, soft=20)
print("done")
