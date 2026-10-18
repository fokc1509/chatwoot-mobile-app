#!/usr/bin/env python3
"""Gera ícone, ícone adaptativo (Android) e splash do app Arqos Atendimento.

Uso (a partir da raiz do repositório):

    python3 scripts/generate-icons.py               # renderiza os PNGs a partir do SVG
    python3 scripts/generate-icons.py --vectorize   # refaz o SVG a partir do raster-fonte e renderiza

Dependências:
    - Python 3.10+
    - Pillow >= 10        (pip install pillow)
    - numpy               (pip install numpy)
    - potracer == 0.0.4   (pip install potracer)  -- só para --vectorize (port Python puro do potrace)
    - Fonte DejaVu Sans Bold (pacote fonts-dejavu-core) para a faixa "DEV"

Fontes:
    - assets/source/arqos-a-source.png: o "A" recortado do logotipo oficial
      (fe-sitearqos/public/logo-dark.png, 1054x248, canal alfa antialiased).
      É a referência de maior resolução disponível do glifo; a imagem 180x180
      enviada pelo usuário é o mesmo "A" e serviu para amostrar as cores.
    - assets/source/arqos-a.svg: vetor gerado (potrace) a partir do raster acima.
      Contém apenas comandos absolutos M/L/C/Z para que este script o leia sem
      dependências de renderização SVG.

Cores amostradas da imagem do usuário (medianas de fundo e glifo):
    fundo #E9E4DE, glifo #2D2926 (o logotipo usa o mesmo #2D2926).
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'assets'
SOURCE_PNG = ASSETS / 'source' / 'arqos-a-source.png'
SOURCE_SVG = ASSETS / 'source' / 'arqos-a.svg'

BG = (0xE9, 0xE4, 0xDE)  # creme
FG = (0x2D, 0x29, 0x26)  # glifo
DEV_BAND = (0xD9, 0x4F, 0x2B)  # laranja-tijolo, contrasta com creme e com o glifo
DEV_TEXT = (0xFF, 0xFF, 0xFF)
DEV_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

UPSCALE = 8  # fator de ampliação do raster antes do potrace
BLUR = 0.6 * UPSCALE  # raio do desfoque gaussiano (px ampliados)
OPTTOL = 0.35 * UPSCALE  # tolerância de simplificação de curvas (px ampliados)
SS = 4  # supersampling da renderização


# ---------------------------------------------------------------- vetorização


def vectorize() -> None:
    import potrace  # potracer

    alpha = Image.open(SOURCE_PNG).getchannel('A')
    pad = 4
    padded = Image.new('L', (alpha.width + 2 * pad, alpha.height + 2 * pad), 0)
    padded.paste(alpha, (pad, pad))
    big = padded.resize((padded.width * UPSCALE, padded.height * UPSCALE), Image.BICUBIC)
    # suaviza a grade de pixels do original (senão o potrace segue o serrilhado)
    big = big.filter(ImageFilter.GaussianBlur(BLUR))
    # potracer: pixels escuros (< 50%) são "tinta"
    ink = 255 - np.asarray(big, dtype=np.uint8)
    path = potrace.Bitmap(ink).trace(
        turdsize=50, alphamax=1.0, opticurve=True, opttolerance=OPTTOL
    )

    s = 1.0 / UPSCALE
    off = pad

    def fmt(p) -> str:
        return f'{p.x * s - off:.3f} {p.y * s - off:.3f}'

    parts = []
    for curve in path:
        parts.append(f'M {fmt(curve.start_point)}')
        for seg in curve:
            if seg.is_corner:
                parts.append(f'L {fmt(seg.c)} L {fmt(seg.end_point)}')
            else:
                parts.append(f'C {fmt(seg.c1)} {fmt(seg.c2)} {fmt(seg.end_point)}')
        parts.append('Z')
    d = ' '.join(parts)
    w, h = alpha.size
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {w} {h}" width="{w}" height="{h}">\n'
        f'  <path fill="#{FG[0]:02X}{FG[1]:02X}{FG[2]:02X}" fill-rule="evenodd" d="{d}"/>\n'
        '</svg>\n'
    )
    SOURCE_SVG.write_text(svg)
    print(f'escrito {SOURCE_SVG.relative_to(ROOT)} ({len(path)} contornos)')


# ---------------------------------------------------------------- leitura/raster do SVG


def load_svg() -> tuple[list[list[tuple[float, float]]], tuple[float, float, float, float]]:
    """Lê o SVG gerado e devolve subcaminhos achatados em polígonos + bbox."""
    text = SOURCE_SVG.read_text()
    d = re.search(r' d="([^"]+)"', text).group(1)
    tokens = re.findall(r'[MLCZ]|-?\d+(?:\.\d+)?', d)
    polys: list[list[tuple[float, float]]] = []
    cur: list[tuple[float, float]] = []
    i = 0

    def num(k: int) -> float:
        return float(tokens[k])

    while i < len(tokens):
        t = tokens[i]
        if t == 'M':
            cur = [(num(i + 1), num(i + 2))]
            i += 3
        elif t == 'L':
            cur.append((num(i + 1), num(i + 2)))
            i += 3
        elif t == 'C':
            p0 = cur[-1]
            p1 = (num(i + 1), num(i + 2))
            p2 = (num(i + 3), num(i + 4))
            p3 = (num(i + 5), num(i + 6))
            n = 48
            for k in range(1, n + 1):
                u = k / n
                a, b, c, e = (1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u**3
                cur.append(
                    (
                        a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0],
                        a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1],
                    )
                )
            i += 7
        elif t == 'Z':
            polys.append(cur)
            i += 1
        else:
            raise ValueError(f'token inesperado no SVG: {t}')
    xs = [x for p in polys for x, _ in p]
    ys = [y for p in polys for _, y in p]
    return polys, (min(xs), min(ys), max(xs), max(ys))


def glyph_mask(size: tuple[int, int], height: float, center: tuple[float, float]) -> Image.Image:
    """Máscara L (antialiased) do "A" com a altura dada, centrado (bbox) em center."""
    polys, (x0, y0, x1, y1) = load_svg()
    k = height / (y1 - y0)
    cx, cy = center
    ox = cx - (x0 + x1) / 2 * k
    oy = cy - (y0 + y1) / 2 * k
    W, H = size[0] * SS, size[1] * SS
    mask = Image.new('1', (W, H), 0)
    for poly in polys:  # even-odd: XOR de cada subcaminho
        layer = Image.new('1', (W, H), 0)
        pts = [((x * k + ox) * SS, (y * k + oy) * SS) for x, y in poly]
        ImageDraw.Draw(layer).polygon(pts, fill=1)
        mask = ImageChops.logical_xor(mask, layer)
    return mask.convert('L').resize(size, Image.LANCZOS)


def glyph_aspect() -> float:
    _, (x0, y0, x1, y1) = load_svg()
    return (x1 - x0) / (y1 - y0)


# ---------------------------------------------------------------- composição


def dev_band(size: int, center_frac: float, thickness_frac: float) -> Image.Image:
    """Camada RGBA com faixa diagonal "DEV" (45°, descendo da esquerda p/ direita no canto
    inferior direito). center_frac: posição (x=y) do centro da faixa, fração do lado."""
    W = size * SS
    layer = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    c = center_frac * W
    t = thickness_frac * W / 2 * np.sqrt(2)  # meia espessura medida no eixo x
    # faixa entre as retas x + y = 2c - t e x + y = 2c + t (perpendicular à diagonal)
    big = 4 * W
    pts = [
        (2 * c - t - big, big),
        (2 * c - t + big, -big),
        (2 * c + t + big, -big),
        (2 * c + t - big, big),
    ]
    d.polygon(pts, fill=DEV_BAND + (255,))

    # texto em camada separada, girado -45°
    font = ImageFont.truetype(DEV_FONT, int(thickness_frac * W * 0.62))
    tw = int(thickness_frac * W * 4)
    th = int(thickness_frac * W)
    txt = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    td = ImageDraw.Draw(txt)
    td.text((tw / 2, th / 2), 'DEV', font=font, fill=DEV_TEXT + (255,), anchor='mm')
    txt = txt.rotate(45, resample=Image.BICUBIC, expand=True)
    layer.alpha_composite(txt, (int(c - txt.width / 2), int(c - txt.height / 2)))
    return layer.resize((size, size), Image.LANCZOS)


def solid_with_glyph(size: tuple[int, int], height: float, center: tuple[float, float]) -> Image.Image:
    img = Image.new('RGBA', size, BG + (255,))
    fg = Image.new('RGBA', size, FG + (255,))
    img.paste(fg, (0, 0), glyph_mask(size, height, center))
    return img


def transparent_with_glyph(size: int, height: float) -> Image.Image:
    mask = glyph_mask((size, size), height, (size / 2, size / 2))
    img = Image.new('RGBA', (size, size), FG + (0,))
    img.putalpha(mask)
    return img


def save_opaque(img: Image.Image, name: str) -> None:
    img.convert('RGB').save(ASSETS / name, optimize=True)
    print(f'escrito assets/{name} {img.size}')


def save_rgba(img: Image.Image, name: str) -> None:
    img.save(ASSETS / name, optimize=True)
    print(f'escrito assets/{name} {img.size}')


def render() -> None:
    n = 1024
    # icon.png: fundo creme opaco, "A" com ~60% da altura
    icon = solid_with_glyph((n, n), 0.60 * n, (n / 2, n / 2))
    save_opaque(icon, 'icon.png')
    icon_dev = icon.copy()
    icon_dev.alpha_composite(dev_band(n, 0.80, 0.13))
    save_opaque(icon_dev, 'icon-dev.png')

    # adaptive-icon.png: transparente; bbox do "A" inscrita no círculo de 66% (raio 338px)
    aspect = glyph_aspect()
    safe_d = 0.66 * n
    h = safe_d / np.hypot(1, aspect) * 0.98
    adaptive = transparent_with_glyph(n, h)
    save_rgba(adaptive, 'adaptive-icon.png')
    adaptive_dev = adaptive.copy()
    # faixa mais próxima do centro para continuar visível sob máscaras circulares
    adaptive_dev.alpha_composite(dev_band(n, 0.70, 0.10))
    save_rgba(adaptive_dev, 'adaptive-icon-dev.png')

    # splash.png: 1284x2778 creme, "A" com ~25% da largura
    sw, sh = 1284, 2778
    splash = solid_with_glyph((sw, sh), 0.25 * sw / aspect, (sw / 2, sh / 2))
    save_opaque(splash, 'splash.png')


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--vectorize', action='store_true', help='refaz o SVG a partir do PNG-fonte')
    args = ap.parse_args()
    if args.vectorize or not SOURCE_SVG.exists():
        vectorize()
    render()


if __name__ == '__main__':
    main()
