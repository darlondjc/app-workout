import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Sessao } from '../core/models';
import { dataLocal } from '../core/plan.service';
import { SocialService } from '../core/social.service';
import { Progress } from './progress';

const CHAVE = 'app-workout:mensagens-dispensadas:v1';
const sessao = (id: string, data = dataLocal()): Sessao => ({ id, data, fichaId: 'f', fichaNome: 'A', concluidaEm: Date.now(), registros: [] });

describe('Progress — mensagens de incentivo dispensáveis', () => {
  let fixture: ComponentFixture<Progress>;
  const el = () => fixture.nativeElement as HTMLElement;
  const textos = () => [...el().querySelectorAll('.insight__txt')].map((e) => e.textContent?.trim() ?? '');
  const xs = () => [...el().querySelectorAll('.insight__x')] as HTMLButtonElement[];

  function montar(historico: Sessao[], editavel = true): void {
    fixture = TestBed.createComponent(Progress);
    fixture.componentRef.setInput('historico', historico);
    fixture.componentRef.setInput('editavel', editavel);
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: SocialService, useValue: { publicarMeta: () => undefined } }],
    });
  });

  it('cada mensagem tem um botão para dispensar', () => {
    montar([sessao('a')]);
    expect(textos().length).toBeGreaterThan(0);
    expect(xs().length).toBe(textos().length);
  });

  it('dispensar tira a mensagem e continua assim ao reabrir a tela', () => {
    montar([sessao('a')]);
    const antes = textos();
    const alvo = antes[0];
    xs()[0].click();
    fixture.detectChanges();
    expect(textos()).not.toContain(alvo);
    expect(textos().length).toBe(Math.min(antes.length - 1, 4));
    expect(JSON.parse(localStorage.getItem(CHAVE)!)).toContain(alvo);

    fixture.destroy();
    montar([sessao('a')]);
    expect(textos()).not.toContain(alvo);
  });

  const ontem = () => dataLocal(new Date(Date.now() - 86400000));

  it('mensagem nova (texto diferente) aparece mesmo com outras dispensadas', () => {
    montar([sessao('a')]);
    const antigos = textos();
    while (xs().length) {
      xs()[0].click();
      fixture.detectChanges();
    }
    expect(textos()).toEqual([]);

    // Mais um treino muda os números da semana: a mensagem passa a ter outro texto.
    fixture.componentRef.setInput('historico', [sessao('a'), sessao('b', ontem())]);
    fixture.detectChanges();
    const novos = textos().filter((t) => !antigos.includes(t));
    expect(novos.length).toBeGreaterThan(0);
  });

  it('a dispensa é esquecida quando a mensagem deixa de existir: se voltar, aparece de novo', () => {
    montar([sessao('a')]);
    const alvo = textos().find((t) => t.startsWith('Treino de hoje feito'))!;
    xs()[textos().indexOf(alvo)].click();
    fixture.detectChanges();
    expect(JSON.parse(localStorage.getItem(CHAVE)!)).toEqual([alvo]);

    // Sem treino hoje, "Treino de hoje feito" deixa de existir e a dispensa é esquecida.
    fixture.componentRef.setInput('historico', [sessao('b', ontem())]);
    fixture.detectChanges();
    TestBed.tick();
    expect(JSON.parse(localStorage.getItem(CHAVE)!)).not.toContain(alvo);

    fixture.componentRef.setInput('historico', [sessao('a')]);
    fixture.detectChanges();
    expect(textos()).toContain(alvo);
  });

  it('nas estatísticas de um amigo não há botão de dispensar', () => {
    montar([sessao('a')], false);
    expect(textos().length).toBeGreaterThan(0);
    expect(xs().length).toBe(0);
  });
});
