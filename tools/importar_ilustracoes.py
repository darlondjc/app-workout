#!/usr/bin/env python3
"""Baixa ilustrações do open-exercise-illustrations (CC0) para os exercícios de tools/ilustracoes.json.

Mapa: id do exercício no app -> id no repositório de origem. Para cada um gera, em public/exercises/<id>/:
0.jpg e 1.jpg (início e fim, em 850x567 como as fotos antigas), anim.webp e thumb.webp. Os exercícios
de uma posição só (prancha, suspensão) ganham 0.jpg e thumb.webp.
As ilustrações são retrato; entram centralizadas sobre o próprio fundo desfocado, para não ficarem com tarjas.
Uso: python3 tools/importar_ilustracoes.py     Requer: pip install pillow
"""
import io
import json
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
import gerar_animacoes
import gerar_miniaturas

BASE = "https://raw.githubusercontent.com/hitmanrepo/open-exercise-illustrations/main/"
LARGURA, ALTURA = 850, 567
SAIDA = Path("public/exercises")


def baixar(caminho: str) -> bytes:
    with urllib.request.urlopen(BASE + caminho, timeout=60) as r:
        return r.read()


def enquadrar(img: Image.Image) -> Image.Image:
    img = img.convert("RGB")
    fundo = img.resize((LARGURA, round(img.height * LARGURA / img.width)), Image.LANCZOS)
    topo = (fundo.height - ALTURA) // 2
    fundo = fundo.crop((0, topo, LARGURA, topo + ALTURA)).filter(ImageFilter.GaussianBlur(60))
    fundo = ImageEnhance.Brightness(fundo).enhance(0.45)
    frente = img.copy()
    frente.thumbnail((LARGURA, ALTURA), Image.LANCZOS)
    fundo.paste(frente, ((LARGURA - frente.width) // 2, (ALTURA - frente.height) // 2))
    return fundo


def main() -> None:
    mapa = json.loads(Path("tools/ilustracoes.json").read_text(encoding="utf8"))
    dados = json.loads(baixar("exercises.json"))
    meta = {x["id"]: x for x in (dados["exercises"] if isinstance(dados, dict) else dados)}
    for nosso, deles in mapa.items():
        imagens = meta[deles]["images"]
        quadros = [imagens[k] for k in ("start", "end") if k in imagens] or [imagens["hold"]]
        pasta = SAIDA / nosso
        pasta.mkdir(parents=True, exist_ok=True)
        for i, caminho in enumerate(quadros):
            enquadrar(Image.open(io.BytesIO(baixar(caminho)))).save(pasta / f"{i}.jpg", "JPEG", quality=82, optimize=True)
        gerar_miniaturas.gerar(pasta, gerar_miniaturas.LARGURA_PADRAO)
        if len(quadros) > 1:
            gerar_animacoes.gerar(pasta, gerar_animacoes.LARGURA_PADRAO)
        print(f"{nosso}: {len(quadros)} imagem(ns)")


if __name__ == "__main__":
    main()
