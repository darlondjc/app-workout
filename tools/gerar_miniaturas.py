#!/usr/bin/env python3
"""Gera public/exercises/<id>/thumb.webp (320 px de largura) a partir de 0.jpg.

As listas (Biblioteca, fichas, histórico) mostram a foto em ~56 px; carregar o
JPG de 850 px (70 a 110 KB) para isso pesava mais de 2 MB só na Biblioteca. A
miniatura em WebP tem cerca de 5 a 10 KB.

Uso: python3 tools/gerar_miniaturas.py [pasta_exercises] [largura]
Requer: pip install pillow
"""
import sys
from pathlib import Path

from PIL import Image

LARGURA_PADRAO = 320


def gerar(pasta: Path, largura: int) -> bool:
    origem = pasta / "0.jpg"
    if not origem.exists():
        return False
    img = Image.open(origem).convert("RGB")
    altura = round(img.height * largura / img.width)
    img.resize((largura, altura), Image.LANCZOS).save(pasta / "thumb.webp", "WEBP", quality=72, method=6)
    return True


def main() -> None:
    raiz = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("public/exercises")
    largura = int(sys.argv[2]) if len(sys.argv) > 2 else LARGURA_PADRAO
    feitas = sum(gerar(p, largura) for p in sorted(raiz.iterdir()) if p.is_dir())
    print(f"{feitas} miniaturas geradas em {raiz}")


if __name__ == "__main__":
    main()
