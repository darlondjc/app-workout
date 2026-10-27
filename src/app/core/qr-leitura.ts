import jsQR from 'jsqr';

/** Lê um QR code de uma imagem (quadro da câmera). Devolve o texto, ou `null` se não houver QR legível. */
export function lerQr(imagem: ImageData): string | null {
  return jsQR(imagem.data, imagem.width, imagem.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
}
