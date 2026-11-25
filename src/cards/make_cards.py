#!/usr/bin/env python3
"""Gera as artes dos tickets no padrão das noites de inauguração: fotos em P&B de tom quente (300x760 L/R e 900x300 W) e logo com fundo transparente.
Uso: make_cards.py <pasta com originais> <pasta de saída>  (originais: diego.jpg, rg_logo.png, rg_stage.png, rg_trio.png)"""
import sys, numpy as np
from PIL import Image, ImageOps, ImageFilter
from collections import deque
D, O = sys.argv[1], sys.argv[2]
SH = np.array([27, 31, 26], np.float32); HI = np.array([240, 234, 214], np.float32)
def duo(im, lo=0.06, hi=0.94, gamma=0.95):
    g = np.asarray(ImageOps.grayscale(ImageOps.autocontrast(im.convert('RGB'), cutoff=1))).astype(np.float32) / 255
    g = np.clip((g - lo) / (hi - lo), 0, 1) ** gamma
    g = g * g * (3 - 2 * g) * 0.30 + g * 0.70
    return Image.fromarray(np.clip(SH + (HI - SH) * g[..., None], 0, 255).astype(np.uint8))
def fit(im, size, cx, cy):
    return ImageOps.fit(im, size, Image.LANCZOS, centering=(cx, cy))
def save(im, name):
    im.save(f'{O}/{name}', quality=84, optimize=True, progressive=True); print(name, im.size)
def op(n): return ImageOps.exif_transpose(Image.open(f'{D}/{n}')).convert('RGB')
# Diego Küchler: uma foto -> dois enquadramentos (rosto e peito)
d = op('diego.jpg')
save(duo(fit(d, (300, 760), 0.5, 0.20)), 'art-diego-kuchler-L.jpg')
save(duo(fit(d.crop((0, int(d.height * .40), d.width, d.height)), (300, 760), 0.55, 0.0)), 'art-diego-kuchler-R.jpg')
# Rock Grande: logo sem o fundo preto (preenchimento a partir das bordas) + fotos
lg = Image.open(f'{D}/rg_logo.png').convert('RGB'); a = np.asarray(lg).astype(np.int16); h, w = a.shape[:2]
dark = (a.max(axis=2) < 38); bg = np.zeros((h, w), bool); q = deque()
for x in range(w):
    for y in (0, h - 1):
        if dark[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
for y in range(h):
    for x in (0, w - 1):
        if dark[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        yy, xx = y + dy, x + dx
        if 0 <= yy < h and 0 <= xx < w and dark[yy, xx] and not bg[yy, xx]: bg[yy, xx] = True; q.append((yy, xx))
alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
lg.putalpha(alpha); lg = lg.crop(lg.getchannel('A').getbbox()); lg = lg.resize((420, int(lg.height * 420 / lg.width)), Image.LANCZOS)
lg.save(f'{O}/art-rock-grande-logo.png', optimize=True); print('logo', lg.size)
s = op('rg_stage.png'); t = op('rg_trio.png')
save(duo(fit(s, (300, 760), 0.12, 0.35)), 'art-rock-grande-L.jpg')
save(duo(fit(s, (300, 760), 0.95, 0.35)), 'art-rock-grande-R.jpg')
save(duo(fit(t, (900, 300), 0.5, 0.52)), 'art-rock-grande-W.jpg')
