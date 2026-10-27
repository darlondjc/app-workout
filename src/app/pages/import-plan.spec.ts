import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ImportPlan } from './import-plan';

describe('ImportPlan', () => {
  let fixture: ComponentFixture<ImportPlan>;
  let navegar: jasmine.Spy;
  const el = () => fixture.nativeElement as HTMLElement;

  const digitar = (v: string) => {
    const t = el().querySelector('textarea') as HTMLTextAreaElement;
    t.value = v;
    t.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const enviar = () => {
    el().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ImportPlan);
    fixture.detectChanges();
  });

  it('abre a prévia da ficha com o código tirado do link colado', () => {
    digitar('https://site/app-workout/ficha-compartilhada?d=zAbc123');
    enviar();
    expect(navegar).toHaveBeenCalledWith(['/ficha-compartilhada'], { queryParams: { d: 'zAbc123' } });
    expect(el().querySelector('.erro')).toBeNull();
  });

  it('mostra um erro quando o texto não é um link de ficha, e some ao digitar', () => {
    digitar('qualquer coisa');
    enviar();
    expect(navegar).not.toHaveBeenCalled();
    expect(el().querySelector('.erro')!.textContent).toContain('não parece um link de ficha');
    digitar('zAbc');
    expect(el().querySelector('.erro')).toBeNull();
  });

  it('o QR lido abre a prévia da ficha, aceitando o código ou um link antigo', () => {
    (el().querySelector('button.btn--escuro') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el().querySelector('app-qr-leitor')).not.toBeNull();
    fixture.debugElement.query((d) => d.name === 'app-qr-leitor').triggerEventHandler('lido', 'zQr123');
    fixture.detectChanges();
    expect(navegar).toHaveBeenCalledWith(['/ficha-compartilhada'], { queryParams: { d: 'zQr123' } });
    expect(el().querySelector('app-qr-leitor')).toBeNull();
  });

  it('um QR que não é de ficha mostra erro e fecha o leitor', () => {
    (el().querySelector('button.btn--escuro') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.debugElement.query((d) => d.name === 'app-qr-leitor').triggerEventHandler('lido', 'https://outro.site/');
    fixture.detectChanges();
    expect(navegar).not.toHaveBeenCalled();
    expect(el().querySelector('.erro')!.textContent).toContain('não é de uma ficha');
  });
});
