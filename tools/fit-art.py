#!/usr/bin/env python3
"""Fit a painted battlefield background to its guide and install it.

    python3 tools/fit-art.py <map> <painting.png|jpg|webp> [--apply]

1. Finds where the guide frame (art/guides/<map>.png, from tools/make-guides.js) lies inside the painting:
   a separate horizontal and vertical scale plus an offset, by matching edge maps.
2. Writes art/check/<map>.png: the painting with the game's tiles outlined
   (orange = road, cyan = high ground for ranged characters, purple = swamp/sand, blue = water, red = gate, green = crystal)
   so you can see at a glance whether the road and the platforms are where the game expects them.
3. With --apply: saves art/<map>.webp and writes the MAP_ART entry in js/data.js.
"""
import json, os, re, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def edges(img, width):
    g = img.convert('L')
    g = g.resize((width, max(1, round(g.size[1] * width / g.size[0]))), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1))
    a = np.asarray(g, dtype=np.float32)
    gx = np.zeros_like(a); gy = np.zeros_like(a)
    gx[:, 1:-1] = a[:, 2:] - a[:, :-2]
    gy[1:-1, :] = a[2:, :] - a[:-2, :]
    e = np.hypot(gx, gy)
    return e / (e.mean() + 1e-6)


def correlate(big, tmpl):
    """Best placement of tmpl inside big (both 2-D). Returns (score, dy, dx). Placements may hang over the edge by 15%."""
    H, W = big.shape; h, w = tmpl.shape
    ph, pw = H + h, W + w
    t = tmpl - tmpl.mean()
    F = np.fft.rfft2(big, (ph, pw)) * np.conj(np.fft.rfft2(t, (ph, pw)))
    c = np.fft.irfft2(F, (ph, pw))
    # local energy of big under the template window, for normalisation
    ones = np.ones_like(tmpl)
    e = np.fft.irfft2(np.fft.rfft2(big * big, (ph, pw)) * np.conj(np.fft.rfft2(ones, (ph, pw))), (ph, pw))
    score = c / np.sqrt(np.maximum(e, 1e-3) * (t * t).sum())
    # valid shifts: dy in [-0.15h, H-0.85h], dx likewise (shift index wraps for negatives)
    best = (-1, 0, 0)
    for dy in range(-int(.15 * h), int(H - .85 * h) + 1):
        row = score[dy % ph]
        lo, hi = -int(.15 * w), int(W - .85 * w)
        idx = np.arange(lo, hi + 1)
        vals = row[idx % pw]
        k = int(vals.argmax())
        if vals[k] > best[0]:
            best = (float(vals[k]), dy, int(idx[k]))
    return best


def fit(guide, art):
    AW, AH = art.size
    work = 240                                  # working width of the painting
    d = AW / work                               # painting pixels per working pixel
    EA = edges(art, work)
    EG_full = guide
    results = []
    base = AW / guide.size[0]                   # painting px per guide px if the frame spans the painting's width
    def trial(kx, ky):
        tw, th = max(8, round(guide.size[0] * kx / d)), max(8, round(guide.size[1] * ky / d))
        T = edges(EG_full.resize((tw, th), Image.LANCZOS), tw)
        s, dy, dx = correlate(EA, T)
        return s, dx * d, dy * d
    best = None
    for kx in np.arange(.8, 1.21, .04) * base:
        for r in np.arange(.82, 1.19, .03):
            s, x0, y0 = trial(kx, kx * r)
            if best is None or s > best[0]:
                best = (s, kx, kx * r, x0, y0)
    s, kx, ky, _, _ = best
    for kx2 in np.arange(kx * .97, kx * 1.031, kx * .01):
        for ky2 in np.arange(ky * .97, ky * 1.031, ky * .01):
            s2, x0, y0 = trial(kx2, ky2)
            if s2 > best[0]:
                best = (s2, kx2, ky2, x0, y0)
    return best


def overlay(art, info, kx, ky, x0, y0):
    img = art.convert('RGB').copy()
    dr = ImageDraw.Draw(img, 'RGBA')
    W, H, fw, fh, tz, SIN, COS = (info[k] for k in ('w', 'h', 'fw', 'fh', 'tz', 'SIN', 'COS'))
    GW, GH = info['px']
    def to(x, y, h):
        gx = (x - (W - 1) / 2 + fw / 2) / fw * GW
        Y = (y - (H - 1) / 2) * SIN - h * COS
        gy = (Y - tz * SIN + fh / 2) / fh * GH
        return (x0 + gx * kx, y0 + gy * ky)
    col = {'road': (255, 150, 30), 'high': (40, 230, 255), 'swamp': (190, 90, 255), 'sand': (190, 90, 255),
           'water': (60, 110, 255), 'bridge': (255, 150, 30)}
    lw = max(2, round(art.size[0] / 300))
    for c, r, terrain, h, road in info['cells']:
        k = 'road' if road and terrain not in col else terrain
        if k not in col:
            continue
        q = [to(c - .5, r - .5, h), to(c + .5, r - .5, h), to(c + .5, r + .5, h), to(c - .5, r + .5, h)]
        fill = col[k] + (70 if k == 'high' else 35,)
        dr.polygon(q, fill=fill, outline=col[k] + (255,), width=lw * (2 if k == 'high' else 1))
    for g in info['gates']:
        cx, cy = to(g['x'], g['y'], 0); rr = art.size[0] / info['fw'] * .35
        dr.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=(255, 40, 40, 255), width=lw * 2)
    cx, cy = to(info['crystal'][0], min(info['crystal'][1], H - 1), 0); rr = art.size[0] / info['fw'] * .35
    dr.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=(60, 255, 120, 255), width=lw * 2)
    return img


def edge_colour(art):
    a = np.asarray(art.convert('RGB').resize((64, 112)), dtype=np.float32)
    ring = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :3].reshape(-1, 3), a[:, -3:].reshape(-1, 3)])
    r, g, b = (int(v) for v in np.median(ring, axis=0))
    return '#%02x%02x%02x' % (r, g, b)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) != 2:
        print(__doc__); sys.exit(1)
    mid, src = args
    info = json.load(open(os.path.join(ROOT, 'art/guides', mid + '.json')))
    guide = Image.open(os.path.join(ROOT, 'art/guides', mid + '.png')).convert('RGB')
    art = Image.open(src).convert('RGB')
    s, kx, ky, x0, y0 = fit(guide, art)
    AW, AH = art.size
    GW, GH = info['px']
    rect = [x0 / AW, y0 / AH, (x0 + GW * kx) / AW, (y0 + GH * ky) / AH]
    os.makedirs(os.path.join(ROOT, 'art/check'), exist_ok=True)
    out = os.path.join(ROOT, 'art/check', mid + '.png')
    overlay(art, info, kx, ky, x0, y0).save(out)
    stretch = ky / kx
    print(f'{mid}: match {s:.2f}  frame in painting = [{", ".join("%.4f" % v for v in rect)}]  '
          f'(vertical/horizontal scale {stretch:.3f})')
    print(f'  check picture: {os.path.relpath(out, ROOT)}')
    if '--apply' in sys.argv:
        # keep the painting at up to 1440 px wide; webp q88
        img = art
        if AW > 1440:
            img = art.resize((1440, round(AH * 1440 / AW)), Image.LANCZOS)
        dst = os.path.join(ROOT, 'art', mid + '.webp')
        img.save(dst, 'WEBP', quality=88, method=6)
        entry = "%s:{file:'art/%s.webp',rect:[%s],bg:'%s'}" % (mid, mid, ','.join('%.4f' % v for v in rect), edge_colour(art))
        p = os.path.join(ROOT, 'js/data.js'); t = open(p, encoding='utf-8').read()
        m = re.search(r'const MAP_ART=\{(.*?)\};', t, re.S)
        items = [i for i in re.findall(r"\w+:\{[^{}]*\}", m.group(1)) if not i.startswith(mid + ':')] + [entry]
        t = t[:m.start()] + 'const MAP_ART={\n ' + ',\n '.join(items) + '\n};' + t[m.end():]
        open(p, 'w', encoding='utf-8').write(t)
        print(f'  installed {os.path.relpath(dst, ROOT)} ({os.path.getsize(dst) // 1024} KB) and MAP_ART.{mid} in js/data.js')


if __name__ == '__main__':
    main()
