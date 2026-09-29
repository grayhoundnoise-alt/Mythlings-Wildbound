#!/usr/bin/env python3
"""
Turn a chroma-keyed raw drawing into a transparent HD model image.

The image generator gives us a creature on one flat, uniform key colour
(we use pure magenta 255,0,255 because nothing in a Mythling is that
colour). This keys it out, trims the empty margin, and resizes so the
creature is `--height` pixels tall.

Usage:  python3 tools/make-hd-image.py <raw.png> <out.png> [--height 512]
"""
import sys
from PIL import Image, ImageFilter

KEY = (255, 0, 255)
# Pixels within this distance of the key colour are dropped; pixels beyond
# HARD are kept. The gap between them is ramped, so the outline is
# anti-aliased rather than chewed.
NEAR, HARD = 26, 74


def build(raw_path, out_path, out_h=512):
    img = Image.open(raw_path).convert("RGBA")
    w, h = img.size
    px = img.load()
    keyr, keyg, keyb = KEY

    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            d = max(abs(r - keyr), abs(g - keyg), abs(b - keyb))
            if d <= NEAR:
                a = 0
            elif d >= HARD:
                a = 255
            else:
                a = int((d - NEAR) / (HARD - NEAR) * 255)
            px[x, y] = (r, g, b, a)

    # Soften the cut line a touch so the edge reads as drawn, not pasted.
    img.putalpha(img.getchannel("A").filter(ImageFilter.GaussianBlur(0.6)))

    # Trim to the creature, keeping a small even margin.
    bbox = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        pad = 4
        img = img.crop((
            max(0, bbox[0] - pad), max(0, bbox[1] - pad),
            min(w, bbox[2] + pad), min(h, bbox[3] + pad),
        ))

    # Fit to the requested height, preserving aspect, rounded to even pixels.
    scale = out_h / img.height
    nw = max(2, int(round(img.width * scale / 2)) * 2)
    nh = max(2, int(round(img.height * scale / 2)) * 2)
    img = img.resize((nw, nh), Image.LANCZOS)
    img.save(out_path, "PNG", optimize=True)
    return img.size


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        raise SystemExit(1)
    height = int(sys.argv[sys.argv.index("--height") + 1]) if "--height" in sys.argv else 512
    size = build(sys.argv[1], sys.argv[2], height)
    print(f"{sys.argv[2]}  {size[0]}x{size[1]}")
