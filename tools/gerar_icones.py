#!/usr/bin/env python3
"""Gera ícones, favicon e telas de abertura (splash) do app.

Uso (na raiz do projeto):
    pip install pillow playwright && playwright install chromium
    python3 tools/gerar_icones.py

Saídas:
    public/icons/            ícones do manifesto (any e maskable), apple-touch-icon e favicons
    public/splash/           imagens de abertura para iOS (apple-touch-startup-image)
    tools/splash-links.html  trechos <link> das telas de abertura (já colados no src/index.html)
"""
import os
import pathlib
import tempfile

from PIL import Image
from playwright.sync_api import sync_playwright

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ICONES = RAIZ / 'public' / 'icons'
SPLASH = RAIZ / 'public' / 'splash'
NODE_MODULES = pathlib.Path(os.environ.get('NODE_MODULES', RAIZ / 'node_modules'))
FONTE = NODE_MODULES / '@fontsource-variable' / 'bricolage-grotesque' / 'files' / 'bricolage-grotesque-latin-wght-normal.woff2'

TINTA = '#14171A'
TINTA_2 = '#222A2F'
LIMA = '#CDEB3B'
LIMA_CLARO = '#E8F3B8'
LIMA_ESCURO = '#A9C725'

# Halter desenhado em uma tela de 1024, centrado e inclinado. Cabe com folga no círculo
# de 80% do ícone (zona segura dos ícones maskable do Android).
HALTER = f'''
<g transform="translate(512 512) rotate(-40)">
  <rect x="-190" y="-28" width="380" height="56" rx="28" fill="{LIMA_CLARO}"/>
  <g id="lado">
    <rect x="-222" y="-158" width="70" height="316" rx="24" fill="{LIMA}"/>
    <rect x="-292" y="-112" width="60" height="224" rx="22" fill="{LIMA_ESCURO}"/>
    <rect x="-326" y="-44" width="40" height="88" rx="16" fill="{LIMA_CLARO}"/>
  </g>
  <use href="#lado" transform="scale(-1 1)"/>
</g>'''


def svg(raio: int, tamanho: int = 1024, fundo: bool = True) -> str:
    """raio = arredondamento do fundo (0 = quadrado, ocupando tudo); fundo=False deixa só o halter."""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{tamanho}" height="{tamanho}" viewBox="0 0 1024 1024">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{TINTA_2}"/><stop offset="1" stop-color="{TINTA}"/></linearGradient></defs>
{'<rect width="1024" height="1024" rx="%d" fill="url(#g)"/>' % raio if fundo else ''}
{HALTER}
</svg>'''


def render(pg, html: str, largura: int, altura: int, destino: pathlib.Path, transparente=False) -> None:
    pg.set_viewport_size({'width': largura, 'height': altura})
    arq = pathlib.Path(tempfile.mkdtemp()) / 'p.html'
    arq.write_text(html, encoding='utf8')
    pg.goto(arq.as_uri())
    pg.wait_for_timeout(150)
    destino.parent.mkdir(parents=True, exist_ok=True)
    pg.screenshot(path=str(destino), omit_background=transparente)


def pagina_icone(conteudo: str, tam: int) -> str:
    return f'<html><body style="margin:0;background:transparent">{conteudo.replace("width=\"1024\" height=\"1024\"", f"width=\"{tam}\" height=\"{tam}\"", 1)}</body></html>'


def pagina_splash(w: int, h: int) -> str:
    lado = int(min(w, h) * 0.52)
    return f'''<html><head><style>
@font-face {{ font-family: B; src: url("{FONTE.as_uri()}"); font-weight: 200 800; }}
html,body {{ margin:0; width:{w}px; height:{h}px; background: radial-gradient(120% 80% at 50% 38%, {TINTA_2}, {TINTA} 70%); }}
.c {{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:{int(lado*0.0)}px; transform: translateY(-4%); }}
.t {{ font-family: B, sans-serif; font-weight:700; font-size:{int(lado*0.115)}px; letter-spacing:-0.02em; color:#fff; }}
.t b {{ color:{LIMA}; font-weight:700; }}
</style></head><body><div class="c">
{svg(0, lado, fundo=False)}
<div class="t">App <b>Workout</b></div></div></body></html>'''


# (largura css, altura css, escala) em retrato; cada item vira uma imagem de abertura do iOS.
APARELHOS = [
    (440, 956, 3), (402, 874, 3), (430, 932, 3), (393, 852, 3), (428, 926, 3), (390, 844, 3),
    (375, 812, 3), (414, 896, 3), (414, 896, 2), (414, 736, 3), (375, 667, 2), (320, 568, 2),
    (1024, 1366, 2), (834, 1194, 2), (820, 1180, 2), (834, 1112, 2), (810, 1080, 2), (768, 1024, 2), (744, 1133, 2),
]


def main() -> None:
    redondo = svg(int(1024 * 0.22))
    cheio = svg(0)
    with sync_playwright() as p:
        nav = p.chromium.launch()
        pg = nav.new_page()  # escala 1: ícones já saem no tamanho final em pixels
        # Ícones "any": cantos arredondados e transparência.
        for t in (48, 72, 96, 128, 144, 152, 192, 384, 512):
            render(pg, pagina_icone(redondo, t), t, t, ICONES / f'icon-{t}x{t}.png', transparente=True)
        # Maskable: fundo cheio; o Android recorta no formato que o aparelho usa.
        for t in (192, 512):
            render(pg, pagina_icone(cheio, t), t, t, ICONES / f'maskable-{t}x{t}.png')
        # iOS: fundo cheio, sem transparência (o iOS aplica o arredondamento).
        render(pg, pagina_icone(cheio, 180), 180, 180, ICONES / 'apple-touch-icon.png')
        render(pg, pagina_icone(redondo, 32), 32, 32, ICONES / 'favicon-32x32.png', transparente=True)
        render(pg, pagina_icone(redondo, 16), 16, 16, ICONES / 'favicon-16x16.png', transparente=True)
        (ICONES / 'icon.svg').write_text(redondo, encoding='utf8')

        links = []
        paginas = {e: nav.new_page(device_scale_factor=e) for e in {e for _, _, e in APARELHOS}}
        for w, h, e in APARELHOS:
            nome = f'splash-{w * e}x{h * e}.png'
            render(paginas[e], pagina_splash(w, h), w, h, SPLASH / nome)
            Image.open(SPLASH / nome).convert('RGB').save(SPLASH / nome, optimize=True)
            links.append(
                f'<link rel="apple-touch-startup-image" href="splash/{nome}" '
                f'media="(device-width: {w}px) and (device-height: {h}px) and (-webkit-device-pixel-ratio: {e}) and (orientation: portrait)">'
            )
        nav.close()

    ico = [Image.open(ICONES / f'icon-{t}x{t}.png').convert('RGBA') for t in (48,)]
    ico[0].save(RAIZ / 'public' / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
    (RAIZ / 'tools' / 'splash-links.html').write_text('\n'.join(links) + '\n', encoding='utf8')
    print(f'{len(links)} imagens de abertura e ícones gerados')


if __name__ == '__main__':
    main()
