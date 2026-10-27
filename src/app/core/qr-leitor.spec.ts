import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QrLeitor } from './qr-leitor';

describe('QrLeitor', () => {
  let fixture: ComponentFixture<QrLeitor>;
  const el = () => fixture.nativeElement as HTMLElement;
  const abrir = async (getUserMedia: () => Promise<MediaStream>) => {
    spyOnProperty(navigator, 'mediaDevices', 'get').and.returnValue({ getUserMedia } as unknown as MediaDevices);
    fixture = TestBed.createComponent(QrLeitor);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('explica quando a pessoa nega a permissão da câmera', async () => {
    await abrir(() => Promise.reject(new DOMException('negado', 'NotAllowedError')));
    expect(el().querySelector('[role=alert]')!.textContent).toContain('Sem permissão');
    expect(el().querySelector('video')).toBeNull();
  });

  it('explica quando não há câmera', async () => {
    await abrir(() => Promise.reject(new DOMException('sem', 'NotFoundError')));
    expect(el().querySelector('[role=alert]')!.textContent).toContain('Não encontrei uma câmera');
  });

  it('mostra o visor enquanto a câmera abre', async () => {
    await abrir(() => new Promise<MediaStream>(() => undefined));
    expect(el().querySelector('video')).not.toBeNull();
    expect(el().textContent).toContain('Abrindo a câmera');
  });
});
