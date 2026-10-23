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
