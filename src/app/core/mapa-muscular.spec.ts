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
  const todos = [
    ...Object.values(BASE),
    exercicio('crucifixo', ['chest']),
    exercicio('puxada', ['lats']),
  ];
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ExerciseService,
        useValue: {
          get: (id: string) => BASE[id],
          exercises: () => todos,
          nome: (e: Exercise) => (e.id === 'supino' ? 'Supino reto' : e.id === 'crucifixo' ? 'Crucifixo' : e.id),
          equipamento: () => 'Halteres',
          imagem: (id: string) => `exercises/${id}/0.jpg`,
        },
      },
    ],
  });
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

  it('arrastar para o lado vira o corpo, e um arraste curto ou vertical não', () => {
    const fixture = montar([sessao('supino')]);
    const el: HTMLElement = fixture.nativeElement;
    const palco = el.querySelector('.palco')!;
    const gesto = (x0: number, y0: number, x1: number, y1: number) => {
      palco.dispatchEvent(new PointerEvent('pointerdown', { clientX: x0, clientY: y0, bubbles: true }));
      palco.dispatchEvent(new PointerEvent('pointerup', { clientX: x1, clientY: y1, bubbles: true }));
      fixture.detectChanges();
    };
    gesto(200, 100, 190, 100);
    gesto(200, 100, 100, 220);
    expect(el.querySelector('.giro--costas')).toBeNull();
    gesto(200, 100, 100, 110);
    expect(el.querySelector('.giro--costas')).not.toBeNull();
    expect(el.querySelector('.dica')!.textContent).toContain('a frente');
    gesto(100, 100, 220, 100);
    expect(el.querySelector('.giro--costas')).toBeNull();
  });

  it('o botão "Ver exercícios" lista, em ordem alfabética, os exercícios do músculo e filtra pela busca', () => {
    const fixture = montar([sessao('supino')]);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.ver-ex')).toBeNull();
    el.querySelector<SVGGElement>('g.musculo[aria-label^="Peito"]')!.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('.ver-ex')!.click();
    fixture.detectChanges();
    const nomes = () => Array.from(el.querySelectorAll('.ex strong')).map((e) => e.textContent);
    expect(el.querySelector('app-dialogo')!.textContent).toContain('Exercícios: peito');
    expect(nomes()).toEqual(['Crucifixo', 'Supino reto']);

    const busca = el.querySelector<HTMLInputElement>('.busca')!;
    busca.value = 'supi';
    busca.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(nomes()).toEqual(['Supino reto']);

    busca.value = 'zzz';
    busca.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelector('.exs')!.textContent).toContain('Nenhum exercício encontrado');
  });

  it('tocar num exercício abre a demonstração e fechar o diálogo volta ao mapa', () => {
    const fixture = montar([sessao('supino')]);
    const el: HTMLElement = fixture.nativeElement;
    el.querySelector<SVGGElement>('g.musculo[aria-label^="Peito"]')!.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('.ver-ex')!.click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('.ex')!.click();
    fixture.detectChanges();
    expect(el.querySelector('app-exercicio-dialogo')).not.toBeNull();
    el.querySelector<HTMLButtonElement>('app-exercicio-dialogo .x')!.click();
    fixture.detectChanges();
    expect(el.querySelector('app-exercicio-dialogo')).toBeNull();
    el.querySelector<HTMLButtonElement>('app-dialogo .x')!.click();
    fixture.detectChanges();
    expect(el.querySelector('app-dialogo')).toBeNull();
  });

  it('mostra só uma página de exercícios e libera o resto em "Mostrar mais"', () => {
    const muitos = Array.from({ length: 95 }, (_, i) => exercicio('e' + String(i).padStart(3, '0'), ['chest']));
    muitos.forEach((e) => (BASE[e.id] = e));
    try {
      const fixture = montar([sessao('supino')]);
      const el: HTMLElement = fixture.nativeElement;
      el.querySelector<SVGGElement>('g.musculo[aria-label^="Peito"]')!.dispatchEvent(new Event('click'));
      fixture.detectChanges();
      el.querySelector<HTMLButtonElement>('.ver-ex')!.click();
      fixture.detectChanges();
      expect(el.querySelectorAll('.ex').length).toBe(40);
      el.querySelector<HTMLButtonElement>('.mais')!.click();
      fixture.detectChanges();
      expect(el.querySelectorAll('.ex').length).toBe(80);
    } finally {
      muitos.forEach((e) => delete BASE[e.id]);
    }
  });
});

