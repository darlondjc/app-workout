import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConcluirTreino } from './concluir-treino';

const FOTO = 'data:image/jpeg;base64,/9j/AAAA';

describe('ConcluirTreino', () => {
  let fixture: ComponentFixture<ConcluirTreino>;
  let concluidos: (string | null)[];
  let cancelados: number;
  const el = () => fixture.nativeElement as HTMLElement;
  const botao = (texto: string) => [...el().querySelectorAll('button')].find((b) => b.textContent?.trim() === texto) as HTMLButtonElement | undefined;

  beforeEach(() => {
    concluidos = [];
    cancelados = 0;
    fixture = TestBed.createComponent(ConcluirTreino);
    fixture.componentInstance.concluir.subscribe((f) => concluidos.push(f));
    fixture.componentInstance.cancelar.subscribe(() => cancelados++);
    fixture.detectChanges();
  });

  it('a foto é opcional: concluir sem escolher nada entrega null', () => {
    expect(el().querySelector('[role="dialog"]')?.textContent).toContain('Concluir treino');
    expect(el().querySelector('input[type="file"]')).not.toBeNull();
    expect(el().querySelector('app-enquadrar-foto')).toBeNull();
    botao('Concluir treino')!.click();
    expect(concluidos).toEqual([null]);
  });

  it('com a foto escolhida mostra o quadro de enquadramento e entrega a foto ao concluir', async () => {
    const botaoFoto = fixture.debugElement.query((d) => d.name === 'app-foto-botao');
    botaoFoto.triggerEventHandler('escolhida', FOTO);
    fixture.detectChanges();
    expect((el().querySelector('app-enquadrar-foto img') as HTMLImageElement).src).toBe(FOTO);
    botao('Concluir treino')!.click();
    // A foto de teste não abre como imagem: o recorte falha e vai a foto inteira.
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    expect(concluidos).toEqual([FOTO]);
  });

  it('Remover tira a foto e volta ao estado sem foto', () => {
    fixture.debugElement.query((d) => d.name === 'app-foto-botao').triggerEventHandler('escolhida', FOTO);
    fixture.detectChanges();
    botao('Remover')!.click();
    fixture.detectChanges();
    expect(el().querySelector('app-enquadrar-foto')).toBeNull();
    botao('Concluir treino')!.click();
    expect(concluidos).toEqual([null]);
  });

  it('fechar (X ou Esc) cancela e não conclui', () => {
    (el().querySelector('.x') as HTMLButtonElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cancelados).toBeGreaterThan(0);
    expect(concluidos).toEqual([]);
  });
});
