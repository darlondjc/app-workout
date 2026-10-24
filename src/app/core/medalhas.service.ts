import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ExerciseService } from './exercise.service';
import { Conquista, NovaMedalha, TipoConquista, calcularConquistas, impressaoDoHistorico, niveisGanhos, regiaoDoExercicio } from './medalhas';
import { lerMeta, metaPadrao } from './meta';
import { PlanService, dataLocal } from './plan.service';
import { Sessao } from './models';
import { deIso, dias } from './stats';

const CHAVE = 'app-workout:medalhas:v1';
/** Depois disso, uma medalha nova que ninguém abriu deixa de chamar atenção. */
const DIAS_DE_DESTAQUE = 7;

/** O que fica guardado: as medalhas já calculadas e as novas que a pessoa ainda não viu. */
interface Guardado {
  v: 1;
  /** Impressão do histórico, da meta e do ano com que `conquistas` foi calculado. */
  base: string;
  conquistas: Conquista[];
  novas: NovaMedalha[];
}

function ler(): Guardado | null {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const g = JSON.parse(bruto) as Guardado;
    return g?.v === 1 && typeof g.base === 'string' && Array.isArray(g.conquistas) && Array.isArray(g.novas) ? g : null;
  } catch {
    return null;
  }
}

/** Junta novas pendentes com as recém-ganhas; para a mesma meta vale o nível mais recente. */
function juntar(pendentes: NovaMedalha[], ganhas: NovaMedalha[]): NovaMedalha[] {
  const out = [...pendentes];
  for (const g of ganhas) {
    const i = out.findIndex((p) => p.id === g.id);
    if (i >= 0) out[i] = g;
    else out.push(g);
  }
  return out;
}

/**
 * Medalhas guardadas no aparelho. Elas são calculadas quando o treino termina (e só então, ou quando o histórico,
 * a meta ou o ano mudam por fora) e a tela inicial lê o resultado pronto. As que subiram de nível no treino ficam
 * como "novas" até a pessoa abrir a galeria.
 */
@Injectable({ providedIn: 'root' })
export class MedalhasService {
  private readonly plans = inject(PlanService);
  private readonly exercicios = inject(ExerciseService);

  private readonly guardado = signal<Guardado | null>(ler());

  readonly conquistas = computed(() => this.guardado()?.conquistas ?? []);
  /** Novas ainda recentes e não vistas. */
  readonly novas = computed(() => {
    const hoje = deIso(dataLocal());
    return (this.guardado()?.novas ?? []).filter((n) => dias(deIso(n.em), hoje) <= DIAS_DE_DESTAQUE);
  });
  readonly idsNovos = computed<TipoConquista[]>(() => this.novas().map((n) => n.id));

  constructor() {
    // Quando o catálogo de exercícios fica pronto ou o histórico muda por fora (nuvem), confere se o guardado ainda vale.
    effect(() => {
      this.exercicios.ready();
      this.plans.historico();
      untracked(() => this.garantir());
    });
  }

  /** Recalcula só se o histórico, a meta ou o ano mudaram desde a última conta. As novas pendentes são mantidas. */
  garantir(): void {
    if (!this.exercicios.ready()) return;
    const h = this.plans.historico();
    const base = this.impressao(h);
    const atual = this.guardado();
    if (atual?.base === base) return;
    const conquistas = this.calcular(h);
    // Treino que chegou de outro aparelho: o que subiu de nível por causa dele também conta como novo aqui.
    // Sem guardado anterior (primeiro uso ou conta recém-aberta) não há com o que comparar, então nada é "novo".
    const subiram = atual && atual.conquistas.length > 0 ? niveisGanhos(atual.conquistas, conquistas, dataLocal()).map((n) => ({ ...n, em: conquistas.find((c) => c.id === n.id)?.dataDoNivel ?? n.em })) : [];
    this.gravar({ v: 1, base, conquistas, novas: juntar(atual?.novas ?? [], subiram) });
  }

  /** Chamado ao concluir um treino: calcula as medalhas, guarda e devolve o que subiu de nível neste treino. */
  aposTreino(sessaoId: string): NovaMedalha[] {
    if (!this.exercicios.ready()) return [];
    const h = this.plans.historico();
    const antes = this.calcular(h.filter((s) => s.id !== sessaoId));
    const depois = this.calcular(h);
    const ganhos = niveisGanhos(antes, depois, dataLocal());
    this.gravar({ v: 1, base: this.impressao(h), conquistas: depois, novas: juntar(this.guardado()?.novas ?? [], ganhos) });
    return ganhos;
  }

  /** A pessoa viu as novas (abriu a galeria): somem os destaques. */
  reconhecer(): void {
    const g = this.guardado();
    if (!g || g.novas.length === 0) return;
    this.gravar({ ...g, novas: [] });
  }

  /** Apaga o que está guardado (ao sair da conta). */
  limpar(): void {
    this.guardado.set(null);
    try {
      localStorage.removeItem(CHAVE);
    } catch {
      /* sem armazenamento */
    }
  }

  private meta(): number {
    return lerMeta() ?? metaPadrao(this.plans.fichas().length);
  }

  private impressao(h: Sessao[]): string {
    return impressaoDoHistorico(h, this.meta(), new Date().getFullYear());
  }

  private calcular(h: Sessao[]): Conquista[] {
    return calcularConquistas(h, this.meta(), { hoje: new Date(), regiaoDe: (id) => regiaoDoExercicio(this.exercicios.get(id)) });
  }

  private gravar(g: Guardado): void {
    this.guardado.set(g);
    try {
      localStorage.setItem(CHAVE, JSON.stringify(g));
    } catch {
      /* sem armazenamento: vale só nesta sessão */
    }
  }
}
