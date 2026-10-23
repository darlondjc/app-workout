import { RegistroPeso } from './models';
import { dataISO } from './stats';

export type PeriodoPeso = 'semana' | 'mes' | 'ano';

export const PESO_MINIMO = 20;
export const PESO_MAXIMO = 400;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** "72,5" ou "72.5" → 72.5 (uma casa decimal). Texto inválido ou fora de 20–400 kg → `null`. */
export function lerPeso(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const v = Math.round(Number(t) * 10) / 10;
  return v >= PESO_MINIMO && v <= PESO_MAXIMO ? v : null;
}

/** Mantém só registros bem formados (vem do aparelho ou da nuvem, onde pode haver lixo). */
export function limparPesos(bruto: unknown): RegistroPeso[] {
  if (!Array.isArray(bruto)) return [];
  const porDia = new Map<string, RegistroPeso>();
  for (const r of bruto as Partial<RegistroPeso>[]) {
    if (!r || typeof r.data !== 'string' || !ISO.test(r.data)) continue;
    if (typeof r.kg !== 'number' || !Number.isFinite(r.kg) || r.kg < PESO_MINIMO || r.kg > PESO_MAXIMO) continue;
    porDia.set(r.data, { data: r.data, kg: r.kg, ...(typeof r.em === 'number' ? { em: r.em } : {}) });
  }
  return [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data));
}

/** Acrescenta o registro; se o dia já tinha um, ele é substituído. Sempre em ordem de data. */
export function registrarPeso(lista: RegistroPeso[], novo: RegistroPeso): RegistroPeso[] {
  return [...lista.filter((r) => r.data !== novo.data), novo].sort((a, b) => a.data.localeCompare(b.data));
}

/** União por dia; quando os dois lados têm o mesmo dia, vale o registrado por último. */
export function mesclarPesos(locais: RegistroPeso[], remotos: RegistroPeso[]): RegistroPeso[] {
  const porDia = new Map<string, RegistroPeso>(locais.map((r) => [r.data, r]));
  for (const r of remotos) {
    const l = porDia.get(r.data);
    if (!l || (r.em ?? 0) >= (l.em ?? 0)) porDia.set(r.data, r);
  }
  return [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data));
}

export interface PontoPeso {
  /** Posição na janela do período, de 0 (início) a 1 (fim). */
  x: number;
  kg: number;
  rotulo: string;
}

export interface SeriePeso {
  pontos: PontoPeso[];
  /** Rótulos das duas pontas do eixo (primeiro e último dia ou mês da janela). */
  inicio: string;
  fim: string;
  /** Último ponto menos o primeiro; `null` com menos de dois pontos. */
  variacao: number | null;
  minimo: number;
  maximo: number;
}

const arredondar = (v: number) => Math.round(v * 10) / 10;

function rotuloMes(d: Date): string {
  return d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
}

/**
 * Pontos do gráfico de peso. Semana: os últimos 7 dias. Mês: os últimos 30 dias. Ano: os últimos 12 meses,
 * com a média de cada mês. Dias ou meses sem registro ficam sem ponto (a linha liga os que existem).
 */
export function serieDePeso(registros: RegistroPeso[], periodo: PeriodoPeso, hoje: Date): SeriePeso {
  const pontos: PontoPeso[] = [];
  let inicio: string;
  let fim: string;

  if (periodo === 'ano') {
    inicio = rotuloMes(new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1));
    fim = rotuloMes(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    for (let i = 0; i < 12; i++) {
      const mes = new Date(hoje.getFullYear(), hoje.getMonth() - (11 - i), 1);
      const prefixo = dataISO(mes).slice(0, 7);
      const doMes = registros.filter((r) => r.data.startsWith(prefixo));
      if (doMes.length === 0) continue;
      const media = doMes.reduce((t, r) => t + r.kg, 0) / doMes.length;
      pontos.push({ x: i / 11, kg: arredondar(media), rotulo: rotuloMes(mes) });
    }
  } else {
    const dias = periodo === 'semana' ? 7 : 30;
    const porDia = new Map(registros.map((r) => [r.data, r.kg]));
    const rotuloDia = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
    for (let i = 0; i < dias; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (dias - 1 - i));
      const kg = porDia.get(dataISO(d));
      if (kg !== undefined) pontos.push({ x: i / (dias - 1), kg, rotulo: rotuloDia(d) });
    }
    inicio = rotuloDia(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (dias - 1)));
    fim = rotuloDia(hoje);
  }

  const valores = pontos.map((p) => p.kg);
  return {
    pontos,
    inicio,
    fim,
    variacao: pontos.length >= 2 ? arredondar(pontos[pontos.length - 1].kg - pontos[0].kg) : null,
    minimo: valores.length ? Math.min(...valores) : 0,
    maximo: valores.length ? Math.max(...valores) : 0,
  };
}
