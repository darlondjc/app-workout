#!/usr/bin/env python3
"""Gera public/exercises/<id>/anim.webp a partir de 0.jpg e 1.jpg.

Cada animação alterna as duas posições do exercício (início e fim) em loop.
Usa WebP animado em vez de GIF: o visual é o mesmo, mas o arquivo fica cerca de
cinco vezes menor (~40 KB contra ~200 KB), o que importa para o app offline.

Uso: python3 tools/gerar_animacoes.py [pasta_exercises] [largura]
Requer: pip install pillow
"""
import sys
from pathlib import Path

from PIL import Image

LARGURA_PADRAO = 560
DURACAO_MS = 1100


def gerar(pasta: Path, largura: int) -> bool:
    quadros = []
    for nome in ("0.jpg", "1.jpg"):
        arquivo = pasta / nome
        if not arquivo.exists():
            return False
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
    quadros[0].save(
        pasta / "anim.webp",
        save_all=True,
        append_images=quadros[1:],
        duration=DURACAO_MS,
        loop=0,
        quality=72,
        method=6,
    )
    return True


def main() -> None:
    raiz = Path(sys.argv[1] if len(sys.argv) > 1 else "public/exercises")
    largura = int(sys.argv[2]) if len(sys.argv) > 2 else LARGURA_PADRAO
    feitos = 0
    ignorados = []
    for pasta in sorted(p for p in raiz.iterdir() if p.is_dir()):
        if gerar(pasta, largura):
            feitos += 1
        else:
            ignorados.append(pasta.name)
    print(f"{feitos} animações geradas; {len(ignorados)} sem as duas fotos: {ignorados}")


if __name__ == "__main__":
    main()
