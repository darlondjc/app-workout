import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CloudService } from '../core/cloud.service';
import { SocialService } from '../core/social.service';
import { Social } from './social';

describe('Social — faixa de pessoas', () => {
  let fixture: ComponentFixture<Social>;
  let amigos: ReturnType<typeof signal<{ perfil: { uid: string; nome: string; foto: string | null } }[]>>;

  const el = () => fixture.nativeElement as HTMLElement;
  const lista = () => el().querySelector('.pessoas') as HTMLElement;
  const proximoFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

  function criar(qtd: number): void {
    amigos.set(Array.from({ length: qtd }, (_, i) => ({ perfil: { uid: 'u' + i, nome: 'Amigo ' + i, foto: null } })));
    fixture = TestBed.createComponent(Social);
    // Largura de celular: a faixa precisa rolar quando há muita gente.
    el().style.display = 'block';
    el().style.width = '360px';
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

  afterEach(() => el()?.remove());

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
});
