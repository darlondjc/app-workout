import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Conquista } from '../core/medalhas';
import { MedalhasService } from '../core/medalhas.service';
import { SocialService } from '../core/social.service';
import { MemberStats } from './member-stats';

describe('MemberStats', () => {
  let conquistas: Conquista[];
  let fixture: ComponentFixture<MemberStats>;
  let amigo: boolean;
  let pedirAmizade: jasmine.Spy;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => (conquistas = []));

  function criar(): void {
    pedirAmizade = jasmine.createSpy('pedirAmizade').and.resolveTo({ estado: 'pedido-enviado' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MedalhasService, useValue: { conquistasDe: () => conquistas } },
        {
          provide: SocialService,
          useValue: {
            ativo: signal(true),
            erro: signal(''),
            eu: signal({ uid: 'eu', nome: 'Eu', foto: null }),
            conexoesCarregadas: signal(true),
            amizadesCarregadas: signal(true),
            podeVer: () => true,
            ehAmigo: () => amigo,
            amizadeCom: () => undefined,
            perfilDe: () => ({ uid: 'ana', nome: 'Ana Lima', foto: null, metaSemanal: 4 }),
            atualizarPerfil: () => Promise.resolve(),
            sessoesDe: () => [],
            sessoesCarregadas: () => true,
            pesoDe: () => [{ data: '2026-10-20', kg: 80, em: 1 }],
            timeline: signal([]),
            timelineVisivelDePessoa: () => [],
            temMaisDePessoa: () => false,
            carregarMaisDePessoa: () => undefined,
            marcarTimelineVista: () => undefined,
            pedirAmizade,
            removerAmizade: () => Promise.resolve(),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(MemberStats);
    fixture.componentRef.setInput('uid', 'ana');
    fixture.detectChanges();
  }

  it('colega de grupo: só as estatísticas, sem abas, com o convite para virar amigo', () => {
    amigo = false;
    criar();
    expect(el().querySelector('[role="tablist"]')).toBeNull();
    expect(el().textContent).toContain('Adicionar aos amigos mais chegados');
    expect(el().textContent).toContain('Medalhas');
    expect(el().querySelector('app-peso-grafico')).toBeNull(); // o peso é só para amigos
    [...el().querySelectorAll('button')].find((b) => b.textContent?.includes('Adicionar aos amigos'))!.click();
    expect(pedirAmizade).toHaveBeenCalledOnceWith('ana');
  });

  it('amigo: duas abas, começando pela timeline; nas estatísticas aparecem as medalhas e o peso compartilhado', () => {
    amigo = true;
    criar();
    const abas = [...el().querySelectorAll('[role="tab"]')] as HTMLButtonElement[];
    expect(abas.map((a) => a.textContent?.trim())).toEqual(['Timeline', 'Estatísticas']);
    expect(abas[0].getAttribute('aria-selected')).toBe('true');
    expect(el().textContent).toContain('Os treinos concluídos de Ana');
    expect(el().textContent).not.toContain('Adicionar aos amigos');

    abas[1].click();
    fixture.detectChanges();
    expect(abas[1].getAttribute('aria-selected')).toBe('true');
    expect(el().textContent).toContain('Medalhas');
    expect(el().querySelector('app-peso-grafico')).not.toBeNull();
    expect(el().textContent).toContain('Amigo mais chegado');
    expect(el().querySelector('.abas-fixas')).not.toBeNull();
  });

  it('estatísticas: o calendário vem primeiro, depois as medalhas só as conquistadas, em lista horizontal e sem barra de progresso', () => {
    amigo = false;
    conquistas = [
      { id: 'treinos', titulo: 'Treinos', descricao: '', atual: 30, degraus: [], nivel: 'prata', dataDoNivel: null, proximo: { nivel: 'ouro', alvo: 50, conquistado: false, data: null } },
      { id: 'volume', titulo: 'Carga', descricao: '', atual: 0, degraus: [], nivel: null, dataDoNivel: null, proximo: null },
    ];
    criar();
    const pagina = el().querySelector('.pagina') as HTMLElement;
    expect(pagina.classList.contains('pagina--calendario-primeiro')).toBeTrue();
    const calendario = el().querySelector('.calendario') as HTMLElement;
    const medalhas = el().querySelector('.projetado') as HTMLElement;
    expect(getComputedStyle(calendario).order).toBe('-2');
    expect(getComputedStyle(medalhas).order).toBe('-1');
    expect(medalhas.querySelector('app-medalhas-faixa')).not.toBeNull();
    expect(medalhas.querySelectorAll('.item').length).toBe(1); // só a conquistada
    expect(medalhas.textContent).toContain('Prata');
    expect(medalhas.querySelector('.trilha')).toBeNull(); // sem barra de progresso
    expect(getComputedStyle(medalhas.querySelector('.faixa')!).overflowX).toBe('auto');
  });
});
