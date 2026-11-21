import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Exercise, Labels } from './models';

export interface GrupoMuscular {
  key: string;
  label: string;
  muscles: string[];
}

export const GRUPOS: GrupoMuscular[] = [
  { key: 'peito', label: 'Peito', muscles: ['chest'] },
  { key: 'costas', label: 'Costas', muscles: ['lats', 'middle back', 'lower back', 'traps'] },
  { key: 'ombros', label: 'Ombros', muscles: ['shoulders'] },
  { key: 'biceps', label: 'Bíceps', muscles: ['biceps'] },
  { key: 'triceps', label: 'Tríceps', muscles: ['triceps'] },
  {
    key: 'pernas',
    label: 'Pernas',
    muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'abductors', 'adductors'],
  },
  { key: 'abdomen', label: 'Abdômen', muscles: ['abdominals'] },
  { key: 'antebracos', label: 'Antebraços', muscles: ['forearms'] },
  { key: 'pescoco', label: 'Pescoço', muscles: ['neck'] },
];

/** Chave do filtro de cardio: não é um músculo, então fica fora de `GRUPOS` e filtra pela categoria do exercício. */
export const FILTRO_CARDIO = 'cardio';

export const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

@Injectable({ providedIn: 'root' })
export class ExerciseService {
  private readonly http = inject(HttpClient);

  readonly exercises = signal<Exercise[]>([]);
  readonly labels = signal<Labels | null>(null);
  readonly names = signal<Record<string, string>>({});
  /** Passos em português e em inglês: só são baixados quando a tela de um exercício pede (são ~700 KB). */
  private readonly passos = signal<Record<string, string[]> | null>(null);
  private readonly passosEn = signal<Record<string, string[]> | null>(null);
  private baixandoPassos = false;
  private baixandoPassosEn = false;
  private falhouPassos = false;
  readonly ready = signal(false);
  readonly error = signal(false);

  private readonly porId = computed(() => new Map(this.exercises().map((e) => [e.id, e])));

  /** Texto normalizado (nome em português + original em inglês) usado na busca. */
  private readonly indice = computed(() =>
    this.exercises().map((e) => ({ e, texto: normalizar(`${this.nome(e)} ${e.name}`) })),
  );

  readonly equipamentos = computed(() => {
    const l = this.labels();
    if (!l) return [];
    return Object.entries(l.equipment)
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  });

  readonly niveis = computed(() => {
    const l = this.labels();
    if (!l) return [];
    return ['beginner', 'intermediate', 'expert'].map((key) => ({ key, label: l.level[key] }));
  });

  constructor() {
    this.carregar();
  }

  /** Baixa os dados; também serve para tentar de novo depois de uma falha. */
  carregar(): void {
    this.error.set(false);
    forkJoin({
      exercises: this.http.get<Exercise[]>('data/exercises.json'),
      labels: this.http.get<Labels>('data/i18n/pt-BR.labels.json'),
      names: this.http.get<Record<string, string>>('data/i18n/pt-BR.names.json'),
    }).subscribe({
      next: ({ exercises, labels, names }) => {
        this.exercises.set(exercises);
        this.labels.set(labels);
        this.names.set(names);
        this.ready.set(true);
      },
      error: () => this.error.set(true),
    });
  }

  get(id: string): Exercise | undefined {
    return this.porId().get(id);
  }

  nome(e: Exercise): string {
    return this.names()[e.id] ?? e.name;
  }

  /** Baixa os passos do exercício (português; o inglês só se faltar a tradução). Chame ao abrir a tela do exercício. */
  carregarInstrucoes(id: string): void {
    const pt = this.passos();
    if (pt === null) {
      if (this.baixandoPassos) return;
      this.baixandoPassos = true;
      this.http.get<Record<string, string[]>>('data/i18n/pt-BR.instructions.json').subscribe({
        next: (d) => {
          this.passos.set(d);
          this.baixandoPassos = false;
          if (!d[id]?.length) this.carregarInstrucoes(id);
        },
        error: () => {
          // Sem rede e sem cópia guardada: a tela fica sem passos (sem aviso de idioma) até o app ser recarregado.
          this.baixandoPassos = false;
          this.falhouPassos = true;
          this.passos.set({});
          this.passosEn.set({});
        },
      });
      return;
    }
    if (pt[id]?.length || this.passosEn() !== null || this.baixandoPassosEn) return;
    this.baixandoPassosEn = true;
    this.http.get<Record<string, string[]>>('data/i18n/en.instructions.json').subscribe({
      next: (d) => this.passosEn.set(d),
      error: () => this.passosEn.set({}),
      complete: () => (this.baixandoPassosEn = false),
    });
  }

  /** Passos em português; se faltar tradução, devolve o original em inglês. `carregando` enquanto o arquivo não chegou. */
  instrucoes(e: Exercise): { passos: string[]; traduzido: boolean; carregando?: boolean } {
    const pt = this.passos();
    if (pt === null) return { passos: [], traduzido: true, carregando: true };
    if (this.falhouPassos) return { passos: [], traduzido: true };
    if (pt[e.id]?.length) return { passos: pt[e.id], traduzido: true };
    const en = this.passosEn();
    if (en === null && !e.instructions?.length) return { passos: [], traduzido: false, carregando: true };
    return { passos: e.instructions?.length ? e.instructions : (en?.[e.id] ?? []), traduzido: false };
  }

  musculo(chave: string): string {
    return this.labels()?.muscles[chave] ?? chave;
  }

  equipamento(chave: string | null): string {
    if (!chave) return 'Sem equipamento';
    return this.labels()?.equipment[chave] ?? chave;
  }

  nivel(chave: string): string {
    return this.labels()?.level[chave] ?? chave;
  }

  mecanica(chave: string | null): string | null {
    if (!chave) return null;
    return this.labels()?.mechanic[chave] ?? chave;
  }

  categoria(chave: string): string {
    return this.labels()?.category[chave] ?? chave;
  }

  imagem(id: string, indice: 0 | 1): string {
    return `exercises/${id}/${indice}.jpg`;
  }

  /** Miniatura em WebP (320 px) para listas e cartões; a foto inteira (`imagem`) fica para a tela do exercício. */
  miniatura(id: string): string {
    return `exercises/${id}/thumb.webp`;
  }

  animacao(id: string): string {
    return `exercises/${id}/anim.webp`;
  }

  /**
   * Grupos musculares trabalhados por uma lista de exercícios, do mais frequente para o menos.
   * Cardio só entra se a lista não tiver mais nada, para não colocar "Pernas" em todo treino com esteira.
   */
  gruposDe(exerciseIds: readonly string[]): string[] {
    const exercicios = exerciseIds.map((id) => this.get(id)).filter((e): e is Exercise => !!e);
    const musculacao = exercicios.filter((e) => e.category !== 'cardio');
    const base = musculacao.length > 0 ? musculacao : exercicios;
    const contagem = new Map<string, number>();
    for (const e of base) {
      const grupos = new Set(
        e.primaryMuscles
          .map((m) => GRUPOS.find((g) => g.muscles.includes(m))?.label)
          .filter((l): l is string => !!l),
      );
      for (const l of grupos) contagem.set(l, (contagem.get(l) ?? 0) + 1);
    }
    const ordem = GRUPOS.map((g) => g.label);
    return [...contagem.entries()]
      .sort((a, b) => b[1] - a[1] || ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
      .map(([label]) => label);
  }

  buscar(consulta: string, grupo: string, equipamento: string, nivel: string): Exercise[] {
    const q = normalizar(consulta);
    const musculos = GRUPOS.find((g) => g.key === grupo)?.muscles;
    return this.indice()
      .filter(({ e, texto }) => {
        if (q && !texto.includes(q)) return false;
        if (grupo === FILTRO_CARDIO && e.category !== 'cardio') return false;
        if (musculos && !e.primaryMuscles.some((m) => musculos.includes(m))) return false;
        if (equipamento && (e.equipment ?? 'none') !== equipamento) return false;
        if (nivel && e.level !== nivel) return false;
        return true;
      })
      .map(({ e }) => e)
      .sort((a, b) => this.nome(a).localeCompare(this.nome(b), 'pt-BR'));
  }
}
