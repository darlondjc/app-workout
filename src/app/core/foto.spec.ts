import { LIMITE_FOTO, espelharFoto, girarFoto, ZOOM_MAXIMO, posicionar, recortarFoto, reduzirFoto, trechoVisivel } from './foto';

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

describe('enquadramento da foto', () => {
  // Foto 800x600 num quadro 300x225 (mesma proporção): zoom 1 mostra a foto toda.
  it('sem zoom mostra a foto inteira e não deixa mover', () => {
    const p = posicionar(800, 600, 300, 225, { zoom: 1, x: 50, y: 50 });
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
    const t = trechoVisivel(800, 600, 300, 225, { zoom: 1, x: 0, y: 0 });
    expect(t).toEqual({ x: 0, y: 0, largura: 800, altura: 600 });
  });

  it('limita o zoom entre 1 e o máximo', () => {
    expect(posicionar(800, 600, 300, 225, { zoom: 0.2, x: 0, y: 0 }).zoom).toBe(1);
    expect(posicionar(800, 600, 300, 225, { zoom: 99, x: 0, y: 0 }).zoom).toBe(ZOOM_MAXIMO);
  });

  it('foto vertical cobre o quadro e só move na vertical', () => {
    const p = posicionar(600, 800, 300, 225, { zoom: 1, x: 100, y: 1000 });
    expect(p.x).toBe(0);
    expect(p.y).toBeGreaterThan(0);
    expect(p.largura).toBeCloseTo(300, 5);
    // No limite, a borda da foto encosta no quadro.
    expect(p.altura / 2 - p.y).toBeCloseTo(225 / 2, 5);
  });

  it('com zoom, o trecho visível encolhe e acompanha o deslocamento', () => {
    const centro = trechoVisivel(800, 600, 300, 225, { zoom: 2, x: 0, y: 0 });
    expect(centro.largura).toBe(400);
    expect(centro.x).toBe(200);
    // Arrastar a foto para a direita mostra a parte esquerda dela.
    const direita = trechoVisivel(800, 600, 300, 225, { zoom: 2, x: 9999, y: 0 });
    expect(direita.x).toBe(0);
  });
});

describe('recortarFoto', () => {
  async function fotoTeste(w: number, h: number): Promise<string> {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#f00';
    ctx.fillRect(0, 0, w / 2, h);
    ctx.fillStyle = '#00f';
    ctx.fillRect(w / 2, 0, w / 2, h);
    return c.toDataURL('image/jpeg', 0.9);
  }
  async function tamanho(src: string): Promise<HTMLImageElement> {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
  }

  it('gera uma imagem 4:3 dentro do limite, mesmo de uma foto vertical', async () => {
    const out = await recortarFoto(await fotoTeste(300, 400), 300, 225, { zoom: 1, x: 0, y: 0 });
    const img = await tamanho(out);
    expect(img.naturalWidth / img.naturalHeight).toBeCloseTo(4 / 3, 1);
    expect(out.length).toBeLessThan(LIMITE_FOTO * 1.4);
  });

  it('o zoom recorta o lado escolhido', async () => {
    const src = await fotoTeste(400, 300);
    // Zoom 2 deslocado para a direita mostra a metade esquerda (vermelha).
    const out = await tamanho(await recortarFoto(src, 300, 225, { zoom: 2, x: 9999, y: 0 }));
    const c = document.createElement('canvas');
    c.width = out.naturalWidth;
    c.height = out.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(out, 0, 0);
    const [r, , b] = ctx.getImageData(c.width - 5, c.height / 2, 1, 1).data;
    expect(r).toBeGreaterThan(150);
    expect(b).toBeLessThan(100);
  });
});

describe('espelharFoto', () => {
  it('inverte a foto na horizontal e mantém o tamanho', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 10;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 20, 10);
    ctx.fillStyle = '#f00';
    ctx.fillRect(0, 0, 10, 10); // metade esquerda vermelha

    const espelhada = await espelharFoto(canvas.toDataURL('image/png'));
    const img = new Image();
    await new Promise<void>((ok) => {
      img.onload = () => ok();
      img.src = espelhada;
    });
    expect([img.naturalWidth, img.naturalHeight]).toEqual([20, 10]);
    const c2 = document.createElement('canvas');
    c2.width = 20;
    c2.height = 10;
    const x2 = c2.getContext('2d')!;
    x2.drawImage(img, 0, 0);
    const er = x2.getImageData(2, 5, 1, 1).data[0];
    const [dr, dg] = x2.getImageData(17, 5, 1, 1).data;
    expect(er).toBeGreaterThan(200); // esquerda agora é branca (R alto, G alto)
    expect(x2.getImageData(2, 5, 1, 1).data[1]).toBeGreaterThan(200);
    expect(dr).toBeGreaterThan(200);
    expect(dg).toBeLessThan(60); // direita agora é vermelha
  });
});

describe('girarFoto', () => {
  it('gira 90° no sentido horário: troca largura e altura e leva a esquerda para o alto', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 10;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 20, 10);
    ctx.fillStyle = '#f00';
    ctx.fillRect(0, 0, 10, 10); // metade esquerda vermelha

    const girada = await girarFoto(canvas.toDataURL('image/png'));
    const img = new Image();
    await new Promise<void>((ok) => {
      img.onload = () => ok();
      img.src = girada;
    });
    expect([img.naturalWidth, img.naturalHeight]).toEqual([10, 20]);
    const c2 = document.createElement('canvas');
    c2.width = 10;
    c2.height = 20;
    const x2 = c2.getContext('2d')!;
    x2.drawImage(img, 0, 0);
    expect(x2.getImageData(5, 3, 1, 1).data[1]).toBeLessThan(60); // alto: vermelho
    expect(x2.getImageData(5, 16, 1, 1).data[1]).toBeGreaterThan(200); // embaixo: branco
  });
});
