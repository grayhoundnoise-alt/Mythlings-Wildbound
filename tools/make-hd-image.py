#!/usr/bin/env python3
"""
Turn a chroma-keyed raw drawing into a transparent HD model image.

The image generator gives us a creature on one flat, uniform key colour
(we use pure magenta 255,0,255 because nothing in a Mythling is that
colour). This keys it out, removes the key colour that survives in the soft
edge, trims the empty margin, and rescales.

The despill matters. A pixel on the creature's outline is partly creature and
partly key, so a plain threshold keys it out but leaves the remainder tinted
magenta — which shows up in game as a pink halo around the whole creature.
Here the key is unmixed back out algebraically, so the edge is the creature's
own colour at partial alpha instead.

Usage:  python3 tools/make-hd-image.py <raw.png> <out.png> [--height 512]
"""
import sys
from PIL import Image, ImageFilter

KEY = (255, 0, 255)
# Pixels within this distance of the key colour are dropped; pixels beyond
# HARD are kept. The gap between them is ramped, so the outline is
# anti-aliased rather than chewed.
NEAR, HARD = 30, 86


def key_alpha(r, g, b):
    """0 = pure key (transparent), 255 = nothing like the key (opaque)."""
    d = max(abs(r - KEY[0]), abs(g - KEY[1]), abs(b - KEY[2]))
    if d <= NEAR:
        return 0
    if d >= HARD:
        return 255
    return int((d - NEAR) / (HARD - NEAR) * 255)


def unmix(r, g, b, a):
    """Strip the key colour out of a partially covered pixel.

    The pixel is `a` parts creature and `1-a` parts key, so inverting that mix
    gives the creature's true colour. Without this the outline keeps a pink
    tint that no amount of alpha lowering will hide.
    """
    if a >= 254 or a <= 0:
        return (r, g, b)
    f = a / 255.0
    inv = 1.0 - f
    out = []
    for c, k in zip((r, g, b), KEY):
        v = (c - k * inv) / f
        out.append(max(0, min(255, int(round(v)))))
    return tuple(out)


def scrub_residual(px, w, h):
    """Second pass for edges the unmix could not fully clean.

    Where a bright highlight sits against the key, the mix is far from 50/50
    and one unmix leaves a little magenta behind. Any partially transparent
    pixel where red and blue still sit well above green is pulled back down to
    green, which is what removes the last of the pink halo.
    """
    fixed = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0 or a >= 255:
                continue
            lean = min(r, b) - g
            if lean <= 8:
                continue
            pull = min(lean, 70)
            px[x, y] = (r - pull, g, b - pull, a)
            fixed += 1
    return fixed


def build(raw_path, out_path, out_h=512):
    img = Image.open(raw_path).convert("RGBA")
    w, h = img.size
    px = img.load()

    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            a = key_alpha(r, g, b)
            if a == 0:
                px[x, y] = (0, 0, 0, 0)
            elif a < 255:
                px[x, y] = (*unmix(r, g, b, a), a)

    # Soften the cut line a touch so the edge reads as drawn, not pasted.
    img.putalpha(img.getchannel("A").filter(ImageFilter.GaussianBlur(0.5)))

    # Trim to the creature, keeping a small even margin.
    bbox = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        pad = 4
        img = img.crop((
            max(0, bbox[0] - pad), max(0, bbox[1] - pad),
            min(w, bbox[2] + pad), min(h, bbox[3] + pad),
        ))

    # Scrub last: blurring the alpha softens the edge, which is exactly when the
    # remaining magenta shows up, so the cleanup has to come after it.
    scrub_residual(img.load(), img.width, img.height)

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
