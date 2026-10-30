import { TestBed } from '@angular/core/testing';
import { CameraFoto } from './camera-foto';

/** Fluxo de vídeo falso: metade esquerda vermelha, metade direita azul. */
function fluxoFalso(): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = 80;
  canvas.height = 60;
  const ctx = canvas.getContext('2d')!;
  const pintar = () => {
    ctx.fillStyle = '#f00';
    ctx.fillRect(0, 0, 40, 60);
    ctx.fillStyle = '#00f';
    ctx.fillRect(40, 0, 40, 60);
  };
  pintar();
  setInterval(pintar, 30);
  return canvas.captureStream(30);
}

async function esperar(condicao: () => boolean, ms = 4000): Promise<void> {
  const fim = Date.now() + ms;
  while (!condicao() && Date.now() < fim) await new Promise((r) => setTimeout(r, 30));
}

describe('CameraFoto', () => {
  let pedidos: MediaStreamConstraints[];

  function montar(resposta: () => Promise<MediaStream>) {
    pedidos = [];
    spyOn(navigator.mediaDevices, 'getUserMedia').and.callFake((c) => {
      pedidos.push(c!);
      return resposta();
    });
    const fixture = TestBed.createComponent(CameraFoto);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    return fixture;
  }
  const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

  it('abre a câmera frontal por padrão, com o preview espelhado', async () => {
    const f = montar(async () => fluxoFalso());
    await esperar(() => !!el(f).querySelector('video')?.srcObject);
    f.detectChanges();
    expect((pedidos[0].video as MediaTrackConstraints).facingMode).toEqual({ ideal: 'user' });
    expect(el(f).querySelector('video')!.classList.contains('espelho')).toBeTrue();
    f.destroy();
  });

  it('virar a câmera pede a traseira, sem espelhar o preview', async () => {
    const f = montar(async () => fluxoFalso());
    await esperar(() => !!el(f).querySelector('video')?.srcObject);
    f.detectChanges();
    await esperar(() => !el(f).querySelector<HTMLButtonElement>('.virar')!.disabled);
    f.detectChanges();
    el(f).querySelector<HTMLButtonElement>('.virar')!.click();
    f.detectChanges();
    expect((pedidos[1].video as MediaTrackConstraints).facingMode).toEqual({ ideal: 'environment' });
    expect(el(f).querySelector('video')!.classList.contains('espelho')).toBeFalse();
    f.destroy();
  });

  it('a foto sai sem espelhar, mesmo com o preview espelhado', async () => {
    const f = montar(async () => fluxoFalso());
    let foto: Blob | null = null;
    f.componentInstance.tirada.subscribe((b) => (foto = b));
    const v = () => el(f).querySelector('video')!;
    await esperar(() => !!v()?.srcObject && v().videoWidth > 0);
    f.detectChanges();
    await esperar(() => !el(f).querySelector<HTMLButtonElement>('.disparo')!.disabled);
    f.detectChanges();
    el(f).querySelector<HTMLButtonElement>('.disparo')!.click();
    await esperar(() => foto !== null);
    expect(foto).not.toBeNull();
    const img = await createImageBitmap(foto!);
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const esquerda = ctx.getImageData(5, 5, 1, 1).data;
    const direita = ctx.getImageData(img.width - 6, 5, 1, 1).data;
    expect(esquerda[0]).toBeGreaterThan(esquerda[2]); // vermelho à esquerda, como a câmera vê
    expect(direita[2]).toBeGreaterThan(direita[0]);
    f.destroy();
  });

  it('sem permissão, explica e deixa escolher da galeria', async () => {
    const f = montar(() => Promise.reject({ name: 'NotAllowedError' }));
    let galeria = 0;
    f.componentInstance.galeria.subscribe(() => galeria++);
    await esperar(() => (f.detectChanges(), !!el(f).querySelector('.erro')));
    expect(el(f).querySelector('.erro')!.textContent).toContain('Sem permissão');
    el(f).querySelector<HTMLButtonElement>('.galeria')!.click();
    expect(galeria).toBe(1);
    f.destroy();
  });
});
