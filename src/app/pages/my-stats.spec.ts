import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Conquista } from '../core/medalhas';
import { MedalhasService } from '../core/medalhas.service';
import { Sessao } from '../core/models';
import { PlanService } from '../core/plan.service';
import { MyStats } from './my-stats';

const conquista = (id: string, titulo: string, nivel: Conquista['nivel']): Conquista =>
  ({ id, titulo, descricao: '', atual: 5, degraus: [], nivel, dataDoNivel: null, proximo: nivel ? { nivel: 'ouro', alvo: 50, conquistado: false, data: null } : null }) as Conquista;

describe('MyStats', () => {
  let fixture: ComponentFixture<MyStats>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PlanService, useValue: { historico: signal<Sessao[]>([]), fichas: () => [] } },
        {
          provide: MedalhasService,
          useValue: {
            conquistas: () => [conquista('volume', 'Carga', null), conquista('treinos', 'Treinos', 'prata'), conquista('sequencia', 'Dias seguidos', 'bronze')],
            idsNovos: () => [],
            pronto: () => false,
            ganhosDoTreino: () => [],
            reconhecer: () => undefined,
          },
        },
      ],
    });
    fixture = TestBed.createComponent(MyStats);
    fixture.detectChanges();
  });

  it('calendário primeiro e, em seguida, só as medalhas conquistadas, em lista horizontal e sem barra de progresso', () => {
    expect(el().querySelector('.pagina')?.classList.contains('pagina--calendario-primeiro')).toBeTrue();
    const medalhas = el().querySelector('.projetado') as HTMLElement;
    expect(getComputedStyle(el().querySelector('.calendario')!).order).toBe('-2');
    expect(getComputedStyle(medalhas).order).toBe('-1');
    const itens = [...medalhas.querySelectorAll('.item')].map((i) => i.textContent?.replace(/\s+/g, ' ').trim());
    expect(itens.length).toBe(2); // a sem medalha fica de fora
    expect(itens[0]).toContain('Prata'); // do maior nível para o menor
    expect(itens[1]).toContain('Bronze');
    expect(medalhas.querySelector('.trilha')).toBeNull();
    expect(getComputedStyle(medalhas.querySelector('.faixa')!).overflowX).toBe('auto');
  });

  it('Ver todas abre a galeria completa', () => {
    [...el().querySelectorAll('button')].find((b) => b.textContent?.includes('Ver todas'))!.click();
    fixture.detectChanges();
    expect(el().querySelector('[role="dialog"]')).not.toBeNull();
  });
});
