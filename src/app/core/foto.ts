/** Tamanho máximo da foto de treino guardada na nuvem (texto base64 do JPEG). O documento do Firestore aceita até 1 MiB. */
export const LIMITE_FOTO = 250_000;
const LADO_MAXIMO = 900;

/** Foto de perfil: quadrada, 192 px, cerca de 10 KB (o perfil é lido por cada amigo). */
export const LIMITE_FOTO_PERFIL = 30_000;
export const LADO_FOTO_PERFIL = 192;

/**
 * Reduz uma foto (câmera ou galeria) para um JPEG pequeno em data URL: no máximo 900 px no maior lado,
 * baixando a qualidade e, se preciso, o tamanho até caber em `limite`. Respeita a rotação do celular.
 */
export async function reduzirFoto(arquivo: Blob, limite = LIMITE_FOTO, ladoMaximo = LADO_MAXIMO, quadrada = false): Promise<string> {
  const imagem = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  try {
    let lado = ladoMaximo;
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      // Quadrada: recorta o centro; senão mantém a proporção.
      const origem = quadrada ? Math.min(imagem.width, imagem.height) : Math.max(imagem.width, imagem.height);
      const escala = Math.min(1, lado / origem);
      const sx = quadrada ? (imagem.width - origem) / 2 : 0;
      const sy = quadrada ? (imagem.height - origem) / 2 : 0;
      const sw = quadrada ? origem : imagem.width;
      const sh = quadrada ? origem : imagem.height;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sw * escala));
      canvas.height = Math.max(1, Math.round(sh * escala));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Sem suporte a imagens neste navegador.');
      ctx.fillStyle = '#fff'; // PNG com fundo transparente vira JPEG com fundo branco
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imagem, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      for (const qualidade of [0.78, 0.68, 0.58, 0.48, 0.4]) {
        const url = canvas.toDataURL('image/jpeg', qualidade);
        if (url.length <= limite) return url;
      }
      lado = Math.round(lado * 0.8);
    }
    throw new Error('Não consegui reduzir a foto o bastante.');
  } finally {
    imagem.close();
  }
}

/** Proporção (largura / altura) do quadro de enquadramento da foto do treino. */
export const PROPORCAO_FOTO = 4 / 3;
export const ZOOM_MAXIMO = 4;

/** Como a foto está posicionada no quadro: zoom (1 = a foto cobre o quadro) e deslocamento do centro dela, em px do quadro. */
export interface Enquadramento {
  zoom: number;
  x: number;
  y: number;
}

/**
 * Tamanho da foto na tela e o deslocamento já limitado: a foto nunca deixa uma borda vazia no quadro.
 * `iw`/`ih` são o tamanho da foto; `fw`/`fh`, o do quadro.
 */
export function posicionar(iw: number, ih: number, fw: number, fh: number, e: Enquadramento) {
  const zoom = Math.min(ZOOM_MAXIMO, Math.max(1, e.zoom));
  const escala = Math.max(fw / iw, fh / ih) * zoom;
  const largura = iw * escala;
  const altura = ih * escala;
  const folgaX = Math.max(0, (largura - fw) / 2);
  const folgaY = Math.max(0, (altura - fh) / 2);
  return {
    zoom,
    escala,
    largura,
    altura,
    x: Math.min(folgaX, Math.max(-folgaX, e.x)),
    y: Math.min(folgaY, Math.max(-folgaY, e.y)),
  };
}

/** Trecho da foto (em px dela) que aparece no quadro. */
export function trechoVisivel(iw: number, ih: number, fw: number, fh: number, e: Enquadramento) {
  const p = posicionar(iw, ih, fw, fh, e);
  const largura = fw / p.escala;
  const altura = fh / p.escala;
  return { x: iw / 2 - p.x / p.escala - largura / 2, y: ih / 2 - p.y / p.escala - altura / 2, largura, altura };
}

function carregar(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => erro(new Error('Não consegui abrir a foto.'));
    img.src = src;
  });
}

/** A foto espelhada na horizontal (como a câmera frontal mostra), no mesmo tamanho e como JPEG. */
export async function espelharFoto(src: string): Promise<string> {
  const img = await carregar(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Sem suporte a imagens neste navegador.');
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
}

/** A foto girada 90° no sentido horário, como JPEG. */
export async function girarFoto(src: string): Promise<string> {
  const img = await carregar(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalHeight;
  canvas.height = img.naturalWidth;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Sem suporte a imagens neste navegador.');
  ctx.translate(canvas.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
}

/** Recorta o trecho enquadrado e devolve um JPEG pequeno em data URL, nos mesmos limites de `reduzirFoto`. */
export async function recortarFoto(src: string, fw: number, fh: number, e: Enquadramento): Promise<string> {
  const img = await carregar(src);
  const t = trechoVisivel(img.naturalWidth, img.naturalHeight, fw, fh, e);
  const largura = Math.min(LADO_MAXIMO, Math.round(t.largura));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, largura);
  canvas.height = Math.max(1, Math.round(largura / PROPORCAO_FOTO));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Sem suporte a imagens neste navegador.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, t.x, t.y, t.largura, t.altura, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error('Falha ao gerar a foto.'))), 'image/jpeg', 0.9));
  return reduzirFoto(blob);
}
