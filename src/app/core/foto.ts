/** Tamanho máximo da foto de treino guardada na nuvem (texto base64 do JPEG). O documento do Firestore aceita até 1 MiB. */
export const LIMITE_FOTO = 250_000;
const LADO_MAXIMO = 900;

/**
 * Reduz uma foto (câmera ou galeria) para um JPEG pequeno em data URL: no máximo 900 px no maior lado,
 * baixando a qualidade e, se preciso, o tamanho até caber em `limite`. Respeita a rotação do celular.
 */
export async function reduzirFoto(arquivo: Blob, limite = LIMITE_FOTO, ladoMaximo = LADO_MAXIMO): Promise<string> {
  const imagem = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  try {
    let lado = ladoMaximo;
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const escala = Math.min(1, lado / Math.max(imagem.width, imagem.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(imagem.width * escala));
      canvas.height = Math.max(1, Math.round(imagem.height * escala));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Sem suporte a imagens neste navegador.');
      ctx.fillStyle = '#fff'; // PNG com fundo transparente vira JPEG com fundo branco
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height);
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
