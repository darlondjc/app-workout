#!/usr/bin/env python3
"""Gera public/exercises/<id>/anim.webp a partir de 0.jpg e 1.jpg.

A animação vai da posição inicial à final (só de ida) e recomeça em loop. Entre as
duas fotos entram quadros intermediários, estimados por fluxo óptico (DIS, do
OpenCV): cada pixel é deslocado para onde o movimento o levaria e as duas fotos
deslocadas são misturadas. Fica bem mais fluido que alternar as duas fotos.

Usa WebP animado em vez de GIF: o visual é o mesmo, mas o arquivo fica bem menor,
o que importa para o app offline.

Uso: python3 tools/gerar_animacoes.py [pasta_exercises] [largura] [quadros_no_meio] [ids...]
Requer: pip install pillow opencv-python-headless numpy
"""
import sys
from multiprocessing import Pool
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

LARGURA_PADRAO = 560
QUADROS_MEIO = 5
PAUSA_MS = 700  # parado na posição inicial e na final
QUADRO_MS = 90  # cada quadro intermediário


def carregar(pasta: Path, largura: int):
    quadros = []
    for nome in ("0.jpg", "1.jpg"):
        arquivo = pasta / nome
        if not arquivo.exists():
            return None
        img = Image.open(arquivo).convert("RGB")
        altura = round(img.height * largura / img.width)
        quadros.append(img.resize((largura, altura), Image.LANCZOS))
    # algumas fotos têm proporções diferentes: centraliza a 2ª no tamanho da 1ª
    if quadros[1].size != quadros[0].size:
        base = Image.new("RGB", quadros[0].size, (255, 255, 255))
        q = quadros[1]
        q.thumbnail(base.size, Image.LANCZOS)
        base.paste(q, ((base.width - q.width) // 2, (base.height - q.height) // 2))
        quadros[1] = base
    return quadros


def deslocar(img, fluxo, t):
    h, w = img.shape[:2]
    gx, gy = np.meshgrid(np.arange(w), np.arange(h))
    mx = (gx - fluxo[..., 0] * t).astype(np.float32)
    my = (gy - fluxo[..., 1] * t).astype(np.float32)
    return cv2.remap(img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def intermediarios(a: Image.Image, b: Image.Image, n: int):
    ia = cv2.cvtColor(np.array(a), cv2.COLOR_RGB2BGR)
    ib = cv2.cvtColor(np.array(b), cv2.COLOR_RGB2BGR)
    ga = cv2.cvtColor(ia, cv2.COLOR_BGR2GRAY)
    gb = cv2.cvtColor(ib, cv2.COLOR_BGR2GRAY)
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    f_ab = dis.calc(ga, gb, None)
    f_ba = dis.calc(gb, ga, None)
    saida = []
    for k in range(1, n + 1):
        t = k / (n + 1)
        mix = cv2.addWeighted(deslocar(ia, f_ab, t), 1 - t, deslocar(ib, f_ba, 1 - t), t, 0)
        saida.append(Image.fromarray(cv2.cvtColor(mix, cv2.COLOR_BGR2RGB)))
    return saida


def gerar(args) -> tuple[str, bool]:
    pasta, largura, n = args
    pares = carregar(pasta, largura)
    if pares is None:
        return pasta.name, False
    a, b = pares
    quadros = [a, *intermediarios(a, b, n), b]
    duracoes = [PAUSA_MS, *([QUADRO_MS] * n), PAUSA_MS]
    a.save(
        pasta / "anim.webp",
        save_all=True,
        append_images=quadros[1:],
        duration=duracoes,
        loop=0,
        quality=65,
        method=6,
    )
    return pasta.name, True


def main() -> None:
    raiz = Path(sys.argv[1] if len(sys.argv) > 1 else "public/exercises")
    largura = int(sys.argv[2]) if len(sys.argv) > 2 else LARGURA_PADRAO
    n = int(sys.argv[3]) if len(sys.argv) > 3 else QUADROS_MEIO
    ids = sys.argv[4:]
    pastas = [raiz / i for i in ids] if ids else sorted(p for p in raiz.iterdir() if p.is_dir())
    with Pool() as pool:
        resultados = pool.map(gerar, [(p, largura, n) for p in pastas])
    ignorados = [nome for nome, ok in resultados if not ok]
    print(f"{len(resultados) - len(ignorados)} animações geradas; "
          f"{len(ignorados)} sem as duas fotos: {ignorados}")


if __name__ == "__main__":
    main()
