import { TestBed } from '@angular/core/testing';
import { ExerciseService } from './exercise.service';
import { MapaMuscular } from './mapa-muscular';
import { Exercise, Sessao } from './models';

function exercicio(id: string, primaryMuscles: string[], secondaryMuscles: string[] = []): Exercise {
  return { id, name: id, force: null, level: 'beginner', mechanic: null, equipment: null, primaryMuscles, secondaryMuscles, instructions: [], category: 'strength', images: [] };
}

const BASE: Record<string, Exercise> = {
  supino: exercicio('supino', ['chest'], ['triceps']),
  remada: exercicio('remada', ['middle back'], ['biceps']),
};

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sessao(exerciseId: string, series = 4): Sessao {
  return { id: exerciseId, data: hojeIso(), fichaId: 'f', registros: [{ exerciseId, series: Array.from({ length: series }, () => ({ carga: 20, reps: 10 })) }] };
}

function montar(historico: Sessao[]) {
  TestBed.configureTestingModule({ providers: [{ provide: ExerciseService, useValue: { get: (id: string) => BASE[id] } }] });
  const fixture = TestBed.createComponent(MapaMuscular);
  fixture.componentRef.setInput('historico', historico);
  fixture.detectChanges();
  return fixture;
}

describe('MapaMuscular', () => {
  it('sem treinos, avisa que o mapa ainda está vazio e não mostra os rankings', () => {
    const el: HTMLElement = montar([]).nativeElement;
    expect(el.querySelector('.vazio')).not.toBeNull();
    expect(el.querySelector('.listas')).toBeNull();
  });

  it('desenha os dois lados do corpo e deixa só o visível acessível', () => {
    const el: HTMLElement = montar([sessao('supino')]).nativeElement;
    const faces = el.querySelectorAll('svg.face');
    expect(faces.length).toBe(2);
    expect(faces[0].hasAttribute('inert')).toBeFalse();
    expect(faces[1].hasAttribute('inert')).toBeTrue();
  });

  it('lista o peito entre os mais trabalhados e as costas entre os menos', () => {
    const el: HTMLElement = montar([sessao('supino')]).nativeElement;
    const [menos, mais] = Array.from(el.querySelectorAll('.listas section'));
    expect(mais.textContent).toContain('Peito');
    expect(menos.textContent).not.toContain('Peito');
    expect(menos.textContent).toContain('sem treino direto');
  });

  it('tocar num músculo mostra os detalhes e tocar de novo desmarca', () => {
    const fixture = montar([sessao('supino')]);
    const el: HTMLElement = fixture.nativeElement;
    const peito = el.querySelector<SVGGElement>('g.musculo[aria-label^="Peito"]')!;
    peito.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(el.querySelector('.detalhe')!.textContent).toContain('Peito');
    expect(el.querySelector('.detalhe')!.textContent).toContain('4 séries');
    el.querySelector<SVGGElement>('g.musculo[aria-label^="Peito"]')!.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(el.querySelector('.detalhe')!.textContent).toContain('Toque num músculo');
  });

  it('escolher um músculo que só aparece nas costas vira o corpo', () => {
    const fixture = montar([sessao('remada')]);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.giro--costas')).toBeNull();
    el.querySelector<HTMLButtonElement>('.listas .linha')!.click();
    // O primeiro dos "menos trabalhados" é um músculo sem treino; o primeiro de "mais" é a região das costas.
    const mais = el.querySelectorAll<HTMLButtonElement>('.listas section')[1].querySelector('button')!;
    mais.click();
    fixture.detectChanges();
    expect(el.querySelector('.giro--costas')).not.toBeNull();
    expect(el.querySelector('.lados button[aria-pressed="true"]')!.textContent).toContain('Costas');
  });

  it('os botões Frente e Costas viram o corpo', () => {
    const fixture = montar([sessao('supino')]);
    const el: HTMLElement = fixture.nativeElement;
    el.querySelectorAll<HTMLButtonElement>('.lados button')[1].click();
    fixture.detectChanges();
    expect(el.querySelector('.giro--costas')).not.toBeNull();
  });
});
