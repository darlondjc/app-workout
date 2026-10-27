import qrcode from 'qrcode-generator';
import { lerQr } from './qr-leitura';

/** Desenha o QR em pixels, com a margem de 4 módulos, como a câmera veria. */
function imagemDoQr(texto: string, modulo = 6): ImageData {
  const qr = qrcode(0, 'L');
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount() + 8;
  const tela = document.createElement('canvas');
  tela.width = tela.height = n * modulo;
  const ctx = tela.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, tela.width, tela.height);
  ctx.fillStyle = '#000';
  for (let y = 0; y < n - 8; y++) for (let x = 0; x < n - 8; x++) if (qr.isDark(y, x)) ctx.fillRect((x + 4) * modulo, (y + 4) * modulo, modulo, modulo);
  return ctx.getImageData(0, 0, tela.width, tela.height);
}

describe('lerQr', () => {
  it('lê o código de uma ficha de volta, igual ao que entrou no QR', () => {
    const codigo = 'z' + 'AbC-_123'.repeat(40);
    expect(lerQr(imagemDoQr(codigo))).toBe(codigo);
  });

  it('devolve null numa imagem sem QR', () => {
    const tela = document.createElement('canvas');
    tela.width = tela.height = 120;
    const ctx = tela.getContext('2d')!;
    ctx.fillStyle = '#888';
    ctx.fillRect(0, 0, 120, 120);
    expect(lerQr(ctx.getImageData(0, 0, 120, 120))).toBeNull();
  });
});
