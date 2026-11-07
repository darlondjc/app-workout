import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let toast: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    toast = TestBed.inject(ToastService);
  });

  it('o aviso simples some sozinho', fakeAsync(() => {
    toast.mostrar('Ficha salva');
    expect(toast.aviso()).toEqual({ texto: 'Ficha salva' });
    tick(2600);
    expect(toast.aviso()).toBeNull();
  }));

  it('o aviso com Desfazer fica mais tempo e executa a ação uma vez ao tocar', fakeAsync(() => {
    const executar = jasmine.createSpy('executar');
    toast.mostrar('Treino excluído', { rotulo: 'Desfazer', executar });
    tick(2600);
    expect(toast.aviso()?.acao?.rotulo).toBe('Desfazer');
    toast.agir();
    toast.agir();
    expect(executar).toHaveBeenCalledTimes(1);
    expect(toast.aviso()).toBeNull();
  }));

  it('um aviso novo substitui o anterior e a ação dele', fakeAsync(() => {
    const executar = jasmine.createSpy('executar');
    toast.mostrar('Treino excluído', { rotulo: 'Desfazer', executar });
    toast.mostrar('Ficha salva');
    toast.agir();
    expect(executar).not.toHaveBeenCalled();
    tick(2600);
  }));
});
