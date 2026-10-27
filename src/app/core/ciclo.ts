import { Ficha } from './models';

/**
 * Ciclo de vida de uma ficha: ela vale por um período (4 meses por padrão), depois vence e, com o tempo, é arquivada.
 *
 * - **Ativa**: o período ainda não acabou. É a que o app usa para sugerir o treino do dia.
 * - **Vencida**: a data de fim chegou (ou a pessoa criou uma ficha nova, que encerra as ativas no mesmo dia). Fica recolhida
 *   na lista, com as opções de renovar ou arquivar. Só a vencida mais recente fica à vista.
 * - **Arquivada**: guardada em "Fichas arquivadas". Acontece quando a pessoa arquiva, ou sozinha para as vencidas mais antigas.
 *
 * Tudo é calculado a partir das datas: nada precisa ser gravado quando o tempo passa.
 */

export const MESES_PADRAO = 4;
export const MESES_MIN = 1;
export const MESES_MAX = 12;
/** A partir de quantos dias antes do fim o app começa a avisar. */
export const AVISO_DIAS = 10;
/** Quantas fichas vencidas ficam à vista; as mais antigas vão para os arquivados. */
export const MAX_VENCIDAS = 1;

export type Situacao = 'ativa' | 'vencida' | 'arquivada';

/** Uma ficha como a pessoa a vê: um treino solto, ou o conjunto de treinos A, B, C… */
export interface BlocoFichas {
  /** Id do conjunto, ou o id do treino solto. */
  chave: string;
  conjunto?: { id: string; nome: string };
  /** Nome da ficha: o do conjunto, ou o do treino solto. */
  nome: string;
  fichas: Ficha[];
  inicio: string | null;
  fim: string | null;
  /** A pessoa arquivou (ao contrário do arquivamento automático). */
  arquivadaPelaPessoa: boolean;
}

export const chaveDe = (f: Ficha): string => f.conjunto?.id ?? f.id;

/** Agrupa as fichas em blocos, na ordem em que aparecem; os treinos de um conjunto ficam juntos, onde está o primeiro. */
export function agruparEmBlocos(fichas: readonly Ficha[]): BlocoFichas[] {
  const porChave = new Map<string, BlocoFichas>();
  const out: BlocoFichas[] = [];
  for (const f of fichas) {
    const chave = chaveDe(f);
    const existente = porChave.get(chave);
    if (existente) {
      existente.fichas.push(f);
      existente.inicio ??= f.inicio ?? null;
      existente.fim ??= f.fim ?? null;
      existente.arquivadaPelaPessoa ||= f.arquivada === true;
      continue;
    }
    const bloco: BlocoFichas = {
      chave,
      conjunto: f.conjunto,
      nome: f.conjunto?.nome ?? f.nome,
      fichas: [f],
      inicio: f.inicio ?? null,
      fim: f.fim ?? null,
      arquivadaPelaPessoa: f.arquivada === true,
    };
    porChave.set(chave, bloco);
    out.push(bloco);
  }
  return out;
}

/** Último dia do mês (28 a 31) de `ano`/`mes0` (0 = janeiro). */
const ultimoDiaDoMes = (ano: number, mes0: number): number => new Date(ano, mes0 + 1, 0).getDate();

const doisDigitos = (n: number): string => String(n).padStart(2, '0');

/** Soma meses a uma data yyyy-mm-dd, mantendo o dia (ou o último do mês, se ele não existir): 31/10 + 4 meses = 28/02. */
export function somarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const total = a * 12 + (m - 1) + meses;
  const ano = Math.floor(total / 12);
  const mes0 = total % 12;
  const dia = Math.min(d, ultimoDiaDoMes(ano, mes0));
  return `${ano}-${doisDigitos(mes0 + 1)}-${doisDigitos(dia)}`;
}

/** Soma dias a uma data yyyy-mm-dd. */
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + dias));
  return `${t.getUTCFullYear()}-${doisDigitos(t.getUTCMonth() + 1)}-${doisDigitos(t.getUTCDate())}`;
}

/** Dias inteiros de `de` até `ate` (negativo se `ate` for antes). */
export function diasEntre(de: string, ate: string): number {
  const [a1, m1, d1] = de.split('-').map(Number);
  const [a2, m2, d2] = ate.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

/** Dias que faltam para o fim da ficha (0 = termina hoje); `null` se ela não tem data de fim. */
export function diasParaVencer(b: BlocoFichas, hoje: string): number | null {
  return b.fim ? diasEntre(hoje, b.fim) : null;
}

/** Situação de cada bloco (pela chave). A ficha vence no próprio dia do fim; sem data de fim, é ativa. */
export function situacoes(blocos: readonly BlocoFichas[], hoje: string): Map<string, Situacao> {
  const out = new Map<string, Situacao>();
  const vencidas: { b: BlocoFichas; ordem: number }[] = [];
  blocos.forEach((b, ordem) => {
    if (b.arquivadaPelaPessoa) out.set(b.chave, 'arquivada');
    else if (b.fim && b.fim <= hoje) vencidas.push({ b, ordem });
    else out.set(b.chave, 'ativa');
  });
  // A mais recente (fim mais tarde, depois início, depois a que veio por último na lista) fica à vista; as outras são arquivadas.
  vencidas.sort((x, y) => (y.b.fim ?? '').localeCompare(x.b.fim ?? '') || (y.b.inicio ?? '').localeCompare(x.b.inicio ?? '') || y.ordem - x.ordem);
  vencidas.forEach(({ b }, i) => out.set(b.chave, i < MAX_VENCIDAS ? 'vencida' : 'arquivada'));
  return out;
}

/** Ativa e dentro da janela de aviso (faltam `AVISO_DIAS` dias ou menos). */
export function emAviso(b: BlocoFichas, hoje: string): boolean {
  const d = diasParaVencer(b, hoje);
  return d !== null && d > 0 && d <= AVISO_DIAS;
}

/** "Termina hoje", "Termina amanhã", "Termina em 8 dias". */
export function textoDoPrazo(dias: number): string {
  if (dias <= 0) return 'Termina hoje';
  if (dias === 1) return 'Termina amanhã';
  return `Termina em ${dias} dias`;
}

/** "26/02/2027" a partir de "2027-02-26". */
export function dataCurta(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** Limita a duração padrão ao intervalo permitido. */
export function limitarMeses(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : MESES_PADRAO;
  return Math.min(MESES_MAX, Math.max(MESES_MIN, v));
}
