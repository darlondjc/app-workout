import { Sessao } from './models';

export interface Resumo {
  metaSemanal: number;
  treinosSemana: number;
  semanasSeguidas: number;
  melhorSequencia: number;
  totalTreinos: number;
  treinosMes: number;
  treinosMesAnterior: number;
  /** Carga total (kg × repetições) das sessões do mês. */
  volumeMes: number;
  diasSemTreinar: number | null;
  treinouHoje: boolean;
  /** Dias restantes da semana depois de hoje. */
  diasRestantesSemana: number;
  /** As últimas 8 semanas, da mais antiga à atual; `inicio` é a segunda-feira. */
  ultimasSemanas: { inicio: string; treinos: number }[];
  /** Exercícios do último treino com carga acima do melhor anterior. */
  recordes: { exerciseId: string; carga: number; antes: number }[];
  diaFavorito: string | null;
}

export interface Insight {
  tipo: 'conquista' | 'incentivo';
  texto: string;
}

const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function dataISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function deIso(s: string): Date {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, m - 1, d);
}

/** Segunda-feira da semana de `d`. */
export function inicioSemana(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
}

function dias(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function treinosPorDia(h: Sessao[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of h) m.set(s.data, (m.get(s.data) ?? 0) + 1);
  return m;
}

/** Carga total levantada na sessão (kg × repetições; cardio em minutos fica de fora). */
export function volumeSessao(s: Sessao): number {
  let v = 0;
  for (const r of s.registros ?? []) {
    if (r.unidade === 'min') continue;
    for (const x of r.series) v += x.carga * x.reps;
  }
  return Math.round(v);
}

export function treinosNoMes(h: Sessao[], ano: number, mes: number): Sessao[] {
  const prefixo = `${ano}-${String(mes + 1).padStart(2, '0')}`;
  return h.filter((s) => s.data.startsWith(prefixo));
}

/** Treinos por semana (chave = segunda-feira). */
function porSemana(h: Sessao[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of h) {
    const k = dataISO(inicioSemana(deIso(s.data)));
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/**
 * Semanas seguidas em que a meta mínima foi cumprida. A semana atual conta se já cumpriu;
 * se ainda não, a contagem parte da anterior (a semana ainda está em andamento).
 */
export function sequenciaSemanas(h: Sessao[], minimo: number, hoje: Date): { atual: number; melhor: number } {
  const m = porSemana(h);
  const bate = (d: Date) => (m.get(dataISO(d)) ?? 0) >= minimo;
  let cursor = inicioSemana(hoje);
  if (!bate(cursor)) cursor.setDate(cursor.getDate() - 7);
  let atual = 0;
  while (bate(cursor)) {
    atual++;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7);
  }
  let melhor = 0;
  let seguidas = 0;
  const chaves = [...m.keys()].filter((k) => (m.get(k) ?? 0) >= minimo).sort();
  let anterior: Date | null = null;
  for (const k of chaves) {
    const d = deIso(k);
    seguidas = anterior && dias(anterior, d) === 7 ? seguidas + 1 : 1;
    melhor = Math.max(melhor, seguidas);
    anterior = d;
  }
  return { atual, melhor: Math.max(melhor, atual) };
}

export function treinosNaSemana(h: Sessao[], hoje: Date): number {
  const k = dataISO(inicioSemana(hoje));
  return porSemana(h).get(k) ?? 0;
}

function recordesDoUltimo(h: Sessao[]): Resumo['recordes'] {
  const comReg = [...h]
    .filter((s) => s.registros?.length)
    .sort((a, b) => a.data.localeCompare(b.data) || (a.concluidaEm ?? 0) - (b.concluidaEm ?? 0));
  const ultima = comReg.at(-1);
  if (!ultima) return [];
  const antes = comReg.slice(0, -1).flatMap((s) => s.registros ?? []);
  const out: Resumo['recordes'] = [];
  for (const r of ultima.registros ?? []) {
    if (r.unidade === 'min') continue;
    const carga = Math.max(0, ...r.series.map((x) => x.carga));
    const anteriores = antes.filter((x) => x.exerciseId === r.exerciseId && x.unidade !== 'min').flatMap((x) => x.series.map((y) => y.carga));
    if (anteriores.length === 0 || carga <= 0) continue;
    const antigo = Math.max(...anteriores);
    if (carga > antigo) out.push({ exerciseId: r.exerciseId, carga, antes: antigo });
  }
  return out;
}

/** Números do acompanhamento: semana, mês, sequência, volume e recordes. */
export function calcularResumo(h: Sessao[], hoje: Date, meta: number): Resumo {
  const m = porSemana(h);
  const segunda = inicioSemana(hoje);
  const ultimasSemanas = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() - 7 * (7 - i));
    return { inicio: dataISO(d), treinos: m.get(dataISO(d)) ?? 0 };
  });
  const ordenado = [...h].sort((a, b) => a.data.localeCompare(b.data));
  const ultima = ordenado.at(-1);
  const hojeIso = dataISO(hoje);
  const mesAnt = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const doMes = treinosNoMes(h, hoje.getFullYear(), hoje.getMonth());
  const { atual, melhor } = sequenciaSemanas(h, meta, hoje);

  const porDiaSemana = new Array<number>(7).fill(0);
  for (const s of h) porDiaSemana[deIso(s.data).getDay()]++;
  const topo = Math.max(...porDiaSemana);
  const favorito = h.length >= 8 && topo >= 3 && porDiaSemana.filter((n) => n === topo).length === 1 ? NOMES_DIA[porDiaSemana.indexOf(topo)] : null;

  return {
    metaSemanal: meta,
    treinosSemana: m.get(dataISO(segunda)) ?? 0,
    semanasSeguidas: atual,
    melhorSequencia: melhor,
    totalTreinos: h.length,
    treinosMes: doMes.length,
    treinosMesAnterior: treinosNoMes(h, mesAnt.getFullYear(), mesAnt.getMonth()).length,
    volumeMes: doMes.reduce((t, s) => t + volumeSessao(s), 0),
    diasSemTreinar: ultima ? Math.max(0, dias(deIso(ultima.data), deIso(hojeIso))) : null,
    treinouHoje: ultima?.data === hojeIso,
    diasRestantesSemana: 6 - ((hoje.getDay() + 6) % 7),
    ultimasSemanas,
    recordes: recordesDoUltimo(h),
    diaFavorito: favorito,
  };
}

const MARCOS = [5, 10, 25, 50, 100, 200, 365, 500, 1000];

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Mensagens de incentivo a partir dos números, das mais relevantes para as menos. */
export function gerarInsights(r: Resumo, _hoje: Date = new Date()): Insight[] {
  const out: Insight[] = [];
  if (r.totalTreinos === 0) {
    return [{ tipo: 'incentivo', texto: 'Seu primeiro treino aparece aqui, no calendário. Que tal começar hoje?' }];
  }
  const parado = r.diasSemTreinar ?? 0;

  if (parado >= 7) {
    out.push({ tipo: 'incentivo', texto: `Faz ${plural(parado, 'dia', 'dias')} do último treino. Um treino leve hoje já recoloca o ritmo; o mais difícil é começar.` });
  } else if (r.treinouHoje) {
    out.push({ tipo: 'conquista', texto: 'Treino de hoje feito. Descanse, coma e durma bem para completar o resultado.' });
  }

  if (r.treinosSemana >= r.metaSemanal) {
    out.push({ tipo: 'conquista', texto: `Meta da semana batida: ${plural(r.treinosSemana, 'treino', 'treinos')} (meta ${r.metaSemanal}). Excelente consistência.` });
  } else if (parado < 7) {
    const faltam = r.metaSemanal - r.treinosSemana;
    const cabe = faltam <= r.diasRestantesSemana + (r.treinouHoje ? 0 : 1);
    out.push({
      tipo: 'incentivo',
      texto: cabe
        ? `${r.treinosSemana} de ${r.metaSemanal} treinos nesta semana. Faltam ${plural(faltam, 'treino', 'treinos')} e ainda dá tempo.`
        : `${r.treinosSemana} de ${r.metaSemanal} treinos nesta semana. Mesmo sem fechar a meta, cada treino conta.`,
    });
  }

  if (r.semanasSeguidas >= 2) {
    out.push({
      tipo: 'conquista',
      texto: `${r.semanasSeguidas} semanas seguidas na meta.` + (r.semanasSeguidas >= r.melhorSequencia ? ' É a sua melhor sequência até agora.' : ` Sua melhor foi de ${r.melhorSequencia}.`),
    });
  }

  if (r.recordes.length) {
    out.push({
      tipo: 'conquista',
      texto: r.recordes.length === 1 ? 'Novo recorde de carga no último treino. A evolução está aparecendo.' : `${r.recordes.length} recordes de carga no último treino. A evolução está aparecendo.`,
    });
  }

  if (r.treinosMes > 0 && r.treinosMesAnterior > 0) {
    out.push({
      tipo: r.treinosMes > r.treinosMesAnterior ? 'conquista' : 'incentivo',
      texto:
        r.treinosMes > r.treinosMesAnterior
          ? `${plural(r.treinosMes, 'treino', 'treinos')} neste mês: você já passou o mês passado (${r.treinosMesAnterior}).`
          : r.treinosMes === r.treinosMesAnterior
            ? `${plural(r.treinosMes, 'treino', 'treinos')} neste mês, igualando o mês passado.`
            : `${plural(r.treinosMes, 'treino', 'treinos')} neste mês. No mês passado foram ${r.treinosMesAnterior}; ainda dá para alcançar.`,
    });
  }

  const marco = [...MARCOS].reverse().find((n) => r.totalTreinos >= n);
  if (marco && r.totalTreinos - marco < 3) {
    out.push({ tipo: 'conquista', texto: `${marco} treinos concluídos! Você já soma ${r.totalTreinos}. Isso é constância de verdade.` });
  }

  if (r.diaFavorito) {
    out.push({ tipo: 'incentivo', texto: `Seu dia mais forte é ${r.diaFavorito}. Use esse hábito a seu favor.` });
  }
  return out;
}
