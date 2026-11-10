import { RegistroMedidas } from './models';

export type ChaveMedida = 'gordura' | 'musculo' | 'visceral' | 'cintura' | 'tmb';

export interface Medida {
  chave: ChaveMedida;
  rotulo: string;
  /** Nome abreviado, para caber numa linha no formulário e no histórico. */
  curto: string;
  unidade: string;
  min: number;
  max: number;
  /** Casas decimais aceitas e mostradas. */
  casas: number;
}

/** As principais da bioimpedância, mais a circunferência abdominal. */
export const MEDIDAS: readonly Medida[] = [
  { chave: 'gordura', curto: 'Gordura', rotulo: 'Gordura corporal', unidade: '%', min: 2, max: 70, casas: 1 },
  { chave: 'musculo', curto: 'Massa muscular', rotulo: 'Massa muscular', unidade: 'kg', min: 5, max: 100, casas: 1 },
  { chave: 'visceral', curto: 'Visceral', rotulo: 'Gordura visceral', unidade: 'nível', min: 1, max: 30, casas: 0 },
  { chave: 'cintura', curto: 'Abdômen', rotulo: 'Circunferência abdominal', unidade: 'cm', min: 40, max: 250, casas: 1 },
  { chave: 'tmb', curto: 'TMB', rotulo: 'Taxa metabólica basal', unidade: 'kcal', min: 500, max: 5000, casas: 0 },
];

export type ValoresMedidas = Partial<Record<ChaveMedida, number>>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** "33,3" → 33.3. Campo vazio → `undefined` (medida não informada); texto inválido ou fora da faixa → `null`. */
export function lerMedida(texto: string, m: Medida): number | null | undefined {
  const t = texto.trim().replace(',', '.');
  if (t === '') return undefined;
  const regra = m.casas === 0 ? /^\d{1,5}$/ : /^\d{1,3}(\.\d{1,2})?$/;
  if (!regra.test(t)) return null;
  const f = 10 ** m.casas;
  const v = Math.round(Number(t) * f) / f;
  return v >= m.min && v <= m.max ? v : null;
}

export function formatarMedida(v: number, m: Medida): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: m.casas, maximumFractionDigits: m.casas });
}

function valida(v: unknown, m: Medida): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= m.min && v <= m.max;
}

/** Mantém só registros bem formados e com pelo menos uma medida válida (vem do aparelho ou da nuvem). */
export function limparMedidas(bruto: unknown): RegistroMedidas[] {
  if (!Array.isArray(bruto)) return [];
  const porDia = new Map<string, RegistroMedidas>();
  for (const r of bruto as Partial<RegistroMedidas>[]) {
    if (!r || typeof r.data !== 'string' || !ISO.test(r.data)) continue;
    const limpo: RegistroMedidas = { data: r.data, ...(typeof r.em === 'number' ? { em: r.em } : {}) };
    let algum = false;
    for (const m of MEDIDAS) {
      const v = r[m.chave];
      if (valida(v, m)) {
        limpo[m.chave] = v;
        algum = true;
      }
    }
    if (algum) porDia.set(r.data, limpo);
  }
  return [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data));
}

/** Registra as medidas do dia; se o dia já tinha registro, só os campos informados mudam. */
export function registrarMedidas(lista: RegistroMedidas[], data: string, valores: ValoresMedidas, em: number): RegistroMedidas[] {
  const antigo = lista.find((r) => r.data === data);
  return [...lista.filter((r) => r.data !== data), { ...antigo, ...valores, data, em }].sort((a, b) => a.data.localeCompare(b.data));
}

/** Põe de volta um registro apagado (desfazer), sem passar por cima de um dia que já ganhou outro. */
export function restaurarMedidas(lista: RegistroMedidas[], r: RegistroMedidas): RegistroMedidas[] {
  if (lista.some((x) => x.data === r.data)) return lista;
  return [...lista, r].sort((a, b) => a.data.localeCompare(b.data));
}

/** União por dia; quando os dois lados têm o mesmo dia, vale o registrado por último. */
export function mesclarMedidas(locais: RegistroMedidas[], remotos: RegistroMedidas[]): RegistroMedidas[] {
  const porDia = new Map<string, RegistroMedidas>(locais.map((r) => [r.data, r]));
  for (const r of remotos) {
    const l = porDia.get(r.data);
    if (!l || (r.em ?? 0) >= (l.em ?? 0)) porDia.set(r.data, r);
  }
  return [...porDia.values()].sort((a, b) => a.data.localeCompare(b.data));
}

export interface UltimaMedida {
  medida: Medida;
  valor: number;
  data: string;
}

/** O valor mais recente de cada medida já informada (cada uma pode ser de um dia diferente). */
export function ultimasMedidas(registros: RegistroMedidas[]): UltimaMedida[] {
  const saida: UltimaMedida[] = [];
  for (const medida of MEDIDAS) {
    const r = [...registros].reverse().find((x) => typeof x[medida.chave] === 'number');
    if (r) saida.push({ medida, valor: r[medida.chave] as number, data: r.data });
  }
  return saida;
}
