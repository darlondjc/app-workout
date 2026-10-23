import { LIMITE_FOTO, reduzirFoto } from './foto';

/** Imagem sintética em PNG; com `ruido`, cada pixel é aleatório (a pior situação para a compressão). */
async function imagem(largura: number, altura: number, ruido: boolean): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d')!;
  if (ruido) {
    const dados = ctx.createImageData(largura, altura);
    for (let i = 0; i < dados.data.length; i += 4) {
      dados.data[i] = Math.random() * 256;
      dados.data[i + 1] = Math.random() * 256;
      dados.data[i + 2] = Math.random() * 256;
      dados.data[i + 3] = 255;
    }
    ctx.putImageData(dados, 0, 0);
  } else {
    ctx.fillStyle = '#3a7';
    ctx.fillRect(0, 0, largura, altura);
  }
  return new Promise((ok) => canvas.toBlob((b) => ok(b!), 'image/png'));
}

function medir(url: string): Promise<{ w: number; h: number }> {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => ok({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => erro(new Error('imagem inválida'));
    img.src = url;
  });
}

describe('reduzirFoto', () => {
  it('devolve um JPEG em data URL, com no máximo 900 px no maior lado e a proporção mantida', async () => {
    const url = await reduzirFoto(await imagem(1800, 1200, false));
    expect(url.startsWith('data:image/jpeg;base64,')).toBeTrue();
    const { w, h } = await medir(url);
    expect(w).toBe(900);
    expect(h).toBe(600);
  });

  it('foto pequena não é ampliada', async () => {
    const { w, h } = await medir(await reduzirFoto(await imagem(300, 200, false)));
    expect([w, h]).toEqual([300, 200]);
  });

  it('mesmo uma foto cheia de ruído cabe no limite, baixando qualidade e tamanho', async () => {
    const url = await reduzirFoto(await imagem(1400, 1000, true));
    expect(url.length).toBeLessThanOrEqual(LIMITE_FOTO);
    expect(url.startsWith('data:image/jpeg;base64,')).toBeTrue();
  });

  it('desiste com erro se não conseguir caber no limite', async () => {
    await expectAsync(reduzirFoto(await imagem(400, 300, true), 100)).toBeRejected();
  });

  it('arquivo que não é imagem dá erro', async () => {
    await expectAsync(reduzirFoto(new Blob(['texto'], { type: 'text/plain' }))).toBeRejected();
  });

  it('quadrada: recorta o centro e respeita o lado máximo', async () => {
    const { w, h } = await medir(await reduzirFoto(await imagem(1000, 600, false), 30_000, 192, true));
    expect([w, h]).toEqual([192, 192]);
  });
});
