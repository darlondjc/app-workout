import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CloudService } from '../core/cloud.service';
import { Evento } from '../core/social';
import { SocialService } from '../core/social.service';
import { EventoCard } from './evento-card';
import { Social } from './social';

@Component({ selector: 'app-evento-card', template: '<div class="cartao-falso" style="height: 300px">{{ evento().id }}</div>', changeDetection: ChangeDetectionStrategy.OnPush })
class CartaoFalso {
  readonly evento = input.required<Evento>();
}

describe('Social — rolagem infinita da timeline', () => {
  let fixture: ComponentFixture<Social>;
  let todos: ReturnType<typeof signal<{ tipo: 'evento'; chave: string; criadoEm: number; evento: Evento }[]>>;
  let pagina: ReturnType<typeof signal<number>>;
  let temMais: ReturnType<typeof computed<boolean>>;
  let pedidos: number;

  const el = () => fixture.nativeElement as HTMLElement;
  const cartoes = () => el().querySelectorAll('.cartao-falso').length;
  const pausa = () => new Promise<void>((r) => setTimeout(r, 80));

  const item = (n: number) => {
    const evento = { id: `e${n}`, autor: 'ana', autorNome: 'Ana', autorFoto: null, tipo: 'treino', criadoEm: 1000 - n, sessaoId: 's', data: '2026-10-22', fichaNome: 'A', exercicios: 1, volume: 1, recordes: [] } as Evento;
    return { tipo: 'evento' as const, chave: `e:ana:e${n}`, criadoEm: evento.criadoEm, evento };
  };

  function montar(qtd: number): void {
    todos.set(Array.from({ length: qtd }, (_, i) => item(i)));
    fixture = TestBed.createComponent(Social);
    // A tela rola dentro de uma caixa curta, como o celular: só o começo da lista cabe nela.
    const caixa = document.createElement('div');
    caixa.style.cssText = 'height: 600px; overflow: auto; width: 360px';
    caixa.appendChild(el());
    document.body.appendChild(caixa);
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
    pedidos = 0;
    todos = signal([]);
    pagina = signal(1);
    const visivel = computed(() => todos().slice(0, pagina() * 10));
    temMais = computed(() => visivel().length < todos().length);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CloudService, useValue: { configurado: true, usuario: signal({ uid: 'eu', nome: 'Eu', email: '', foto: null }) } },
        {
          provide: SocialService,
          useValue: {
            ativo: signal(true),
            erro: signal(''),
            timeline: todos,
            timelineVisivel: visivel,
            temMais,
            carregarMais: () => {
              pedidos++;
              if (temMais()) pagina.update((p) => p + 1);
            },
            amigos: signal([]),
            convitesRecebidos: signal([]),
            marcarTimelineVista: () => undefined,
            nomeDe: (_u: string, n: string) => n,
            fotoDe: (_u: string, f: string | null) => f,
          },
        },
      ],
    });
    TestBed.overrideComponent(Social, { remove: { imports: [EventoCard] }, add: { imports: [CartaoFalso] } });
  });

  afterEach(() => el()?.parentElement?.remove());

  it('começa com a primeira página, com o "carregando" no fim', () => {
    montar(40);
    expect(cartoes()).toBe(10);
    expect(el().querySelector('.fim-lista')).not.toBeNull();
  });

  it('o botão de "Carregar mais" pede a próxima página', () => {
    montar(40);
    (el().querySelector('.fim-lista button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(cartoes()).toBe(20);
  });

  it('ao rolar até o fim da lista, a próxima página entra sozinha', async () => {
    montar(40);
    const caixa = el().parentElement as HTMLElement;
    caixa.scrollTop = caixa.scrollHeight;
    await pausa();
    fixture.detectChanges();
    await pausa();
    fixture.detectChanges();
    expect(pedidos).toBeGreaterThan(0);
    expect(cartoes()).toBeGreaterThan(10);
  });

  it('quando tudo foi mostrado, o fim da lista some e nada mais é pedido', async () => {
    montar(8);
    expect(cartoes()).toBe(8);
    expect(el().querySelector('.fim-lista')).toBeNull();
    await pausa();
    expect(pedidos).toBe(0);
  });
});
