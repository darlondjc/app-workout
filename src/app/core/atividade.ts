import { AtividadeRegistro } from './models';

export interface TipoAtividade {
  key: string;
  nome: string;
  /** Faz sentido perguntar a distância. */
  distancia: boolean;
}

/** Atividades oferecidas ao registrar. "Outra" pede o nome. */
export const TIPOS_ATIVIDADE: TipoAtividade[] = [
  { key: 'corrida', nome: 'Corrida', distancia: true },
  { key: 'caminhada', nome: 'Caminhada', distancia: true },
  { key: 'futebol', nome: 'Futebol', distancia: false },
  { key: 'volei-praia', nome: 'Vôlei de praia', distancia: false },
  { key: 'volei-quadra', nome: 'Vôlei de quadra', distancia: false },
  { key: 'beach-tennis', nome: 'Beach tennis', distancia: false },
  { key: 'tenis', nome: 'Tênis', distancia: false },
  { key: 'natacao', nome: 'Natação', distancia: true },
  { key: 'outra', nome: 'Outra', distancia: false },
];

export const ESFORCOS: { key: NonNullable<AtividadeRegistro['esforco']>; nome: string }[] = [
  { key: 'leve', nome: 'Leve' },
  { key: 'moderado', nome: 'Moderado' },
  { key: 'intenso', nome: 'Intenso' },
];

export const MINUTOS_MAXIMO = 600;
export const DISTANCIA_MAXIMA_KM = 500;

/** 75 → "1 h 15 min"; 45 → "45 min". */
export function duracaoTexto(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "5,2 km"; vírgula como separador. */
export function distanciaTexto(km: number): string {
  return `${km.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km`;
}

/** Ex.: "5,2 km · 31 min · Moderado". */
export function resumoAtividade(a: AtividadeRegistro): string {
  const esforco = ESFORCOS.find((e) => e.key === a.esforco)?.nome;
  return [a.distanciaKm ? distanciaTexto(a.distanciaKm) : '', duracaoTexto(a.minutos), esforco ?? ''].filter(Boolean).join(' · ');
}

/** Lê um número digitado ("5,2" ou "5.2"); `null` se vazio ou inválido. */
export function lerNumero(texto: string): number | null {
  const n = Number(texto.trim().replace(',', '.'));
  return texto.trim() !== '' && Number.isFinite(n) ? n : null;
}
