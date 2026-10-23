import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CloudService } from '../core/cloud.service';
import { SocialService } from '../core/social.service';
import { Social, larguraDaPessoa } from './social';

describe('Social — faixa de pessoas', () => {
  let fixture: ComponentFixture<Social>;
  let amigos: ReturnType<typeof signal<{ perfil: { uid: string; nome: string; foto: string | null } }[]>>;

  const el = () => fixture.nativeElement as HTMLElement;
  const lista = () => el().querySelector('.pessoas') as HTMLElement;
  const proximoFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

  function criar(qtd: number, largura = 360): void {
    amigos.set(Array.from({ length: qtd }, (_, i) => ({ perfil: { uid: 'u' + i, nome: 'Amigo ' + i, foto: null } })));
    fixture = TestBed.createComponent(Social);
    // Largura de celular: a faixa precisa rolar quando há muita gente.
    el().style.display = 'block';
    el().style.width = largura + 'px';
    document.body.appendChild(el());
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
    amigos = signal([]);
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
            erro: signal(null),
            timeline: signal([]),
            timelineVisivel: signal([]),
            temMais: signal(false),
            carregarMais: () => undefined,
            amigos,
            convitesRecebidos: signal([]),
            marcarTimelineVista: () => undefined,
            atualizarPerfil: () => Promise.resolve(),
            sessoesDe: () => [],
            sessoesCarregadas: () => true,
            nomeDe: (_u: string, n: string) => n,
            fotoDe: (_u: string, f: string | null) => f,
          },
        },
      ],
    });
  });

  afterEach(() => {
    // Devolve a aba Timeline, que fica guardada fora do componente e vazaria para outros testes.
    (el()?.querySelector('[role="tab"]') as HTMLButtonElement | null)?.click();
    el()?.remove();
  });

  async function abrirEstatisticas(): Promise<void> {
    const abas = [...el().querySelectorAll('[role="tab"]')] as HTMLButtonElement[];
    abas[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    await proximoFrame();
    fixture.detectChanges();
  }

  it('o botão de adicionar amigo fica fora da área rolável, sempre à vista', async () => {
    criar(8);
    await abrirEstatisticas();
    const mais = el().querySelector('.mais') as HTMLElement;
    expect(mais).not.toBeNull();
    expect(lista().contains(mais)).toBeFalse();
    expect(mais.getAttribute('aria-label')).toBe('Adicionar amigos');
  });

  it('com muita gente, esmaece a borda direita para mostrar que há mais', async () => {
    criar(8);
    await abrirEstatisticas();
    expect(lista().scrollWidth).toBeGreaterThan(lista().clientWidth);
    expect(lista().classList).toContain('mais-direita');
    expect(lista().classList).not.toContain('mais-esquerda');
  });

  it('ao rolar até o fim, passa a indicar só o lado esquerdo', async () => {
    criar(8);
    await abrirEstatisticas();
    lista().scrollLeft = lista().scrollWidth;
    lista().dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(lista().classList).toContain('mais-esquerda');
    expect(lista().classList).not.toContain('mais-direita');
  });

  it('com poucos amigos, não indica rolagem', async () => {
    criar(1);
    await abrirEstatisticas();
    expect(lista().classList).not.toContain('mais-direita');
    expect(lista().classList).not.toContain('mais-esquerda');
  });

  it('sempre deixa um pedaço da próxima pessoa à mostra, em qualquer largura de tela', async () => {
    for (const largura of [300, 360, 420, 600]) {
      criar(10, largura);
      await abrirEstatisticas();
      const caixa = lista().getBoundingClientRect();
      const cortados = ([...lista().children] as HTMLElement[]).filter((b) => {
        const r = b.getBoundingClientRect();
        return r.left < caixa.right - 1 && r.right > caixa.right + 1;
      });
      expect(cortados.length).withContext('largura ' + largura).toBe(1);
      const r = cortados[0].getBoundingClientRect();
      const visivel = (caixa.right - r.left) / r.width;
      expect(visivel).withContext('largura ' + largura).toBeGreaterThan(0.2);
      expect(visivel).withContext('largura ' + largura).toBeLessThan(0.8);
      el().remove();
      fixture.destroy();
    }
  });
});

describe('larguraDaPessoa', () => {
  it('não mexe na largura quando todos cabem', () => {
    expect(larguraDaPessoa(360, 3)).toBeNull();
  });
  it('com eu + até 3 amigos, mantém o layout natural em qualquer largura', () => {
    expect(larguraDaPessoa(200, 4)).toBeNull();
    expect(larguraDaPessoa(300, 4)).toBeNull();
  });
  it('com 4 amigos (5 pessoas) em tela estreita, deixa meia pessoa à mostra', () => {
    expect(larguraDaPessoa(332, 5)).not.toBeNull();
  });
  it('com gente além da tela, deixa meia pessoa à mostra', () => {
    const w = larguraDaPessoa(332, 8)!;
    const passo = w + 12;
    expect((332 / passo) % 1).toBeCloseTo(0.5, 5);
  });
});
