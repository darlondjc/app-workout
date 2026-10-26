import { AtividadeRegistro, RegistroExercicio, RegistroPeso, Sessao } from './models';
import { DESCANSO_MAXIMO, descansoMedio, treinosNoMes } from './stats';

/**
 * Estimativa de calorias pelo método MET: kcal = MET × peso (kg) × horas.
 * É uma estimativa (erro de 20 a 30% é normal), por isso a tela sempre mostra "≈".
 * Os MET partem do Compêndio de Atividades Físicas; onde ele não cobre (cardio da ficha, beach tennis,
 * "outra" atividade, a faixa de intensidade da musculação pelo descanso) o valor é uma suposição razoável.
 */

/** Teto da duração de um treino: acima disso, o treino foi deixado aberto. */
export const DURACAO_MAXIMA_MIN = 180;

/** MET da musculação: descanso curto é mais intenso. Sem dado de descanso, vale o mais baixo. */
export const MET_FORCA = { leve: 3.5, moderado: 4.5, intenso: 6.0 } as const;
/** Cardio feito dentro da ficha (esteira, bicicleta…), sem saber a intensidade. */
export const MET_CARDIO_FICHA = 6.0;
export const MET_OUTRA = 5.0;

/** MET base (esforço moderado) de cada tipo de atividade. A corrida usa o ritmo quando há distância. */
export const MET_BASE: Record<string, number> = {
  corrida: 9.8,
  caminhada: 4.3,
  futebol: 7.0,
  'volei-praia': 8.0,
  'volei-quadra': 3.0,
  'beach-tennis': 6.0,
  tenis: 8.0,
  natacao: 5.8,
  outra: MET_OUTRA,
};

const FATOR_ESFORCO = { leve: 0.8, moderado: 1, intenso: 1.25 } as const;

const MET_MINIMO = 2;
const MET_MAXIMO = 16;

const limitar = (v: number) => Math.min(MET_MAXIMO, Math.max(MET_MINIMO, v));

/** Corrida por ritmo: 8,3 MET a 8 km/h e 9,8 MET a 9,7 km/h, seguindo a mesma reta daí em diante. */
function metCorrida(kmPorHora: number): number {
  return limitar(8.3 + (kmPorHora - 8.05) * (1.5 / 1.61));
}

/** MET de uma atividade fora da ficha, a partir do tipo, do esforço e (na corrida) do ritmo. */
export function metAtividade(a: AtividadeRegistro): number {
  if (a.tipo === 'corrida' && a.distanciaKm && a.distanciaKm > 0 && a.minutos > 0) {
    return metCorrida(a.distanciaKm / (a.minutos / 60));
  }
  const base = MET_BASE[a.tipo] ?? MET_OUTRA;
  return limitar(base * FATOR_ESFORCO[a.esforco ?? 'moderado']);
}

/** MET da musculação pelo descanso médio (em segundos) entre as séries. */
export function metForca(descansoMedioSeg: number | null): number {
  if (descansoMedioSeg === null) return MET_FORCA.leve;
  if (descansoMedioSeg <= 60) return MET_FORCA.intenso;
  if (descansoMedioSeg <= 120) return MET_FORCA.moderado;
  return MET_FORCA.leve;
}

/**
 * Duração do treino em minutos, do início à conclusão. Treino deixado aberto por horas não vale: o tempo é
 * limitado a duas vezes a soma dos descansos registrados mais 10 minutos, e nunca passa de 3 horas.
 */
export function duracaoDoTreino(iniciadoEm: number, concluidoEm: number, registros: RegistroExercicio[]): number {
  const real = Math.max(0, (concluidoEm - iniciadoEm) / 60000);
  const soma = somaDescansos(registros) / 60;
  const teto = soma > 0 ? Math.min(DURACAO_MAXIMA_MIN, soma * 2 + 10) : DURACAO_MAXIMA_MIN;
  return Math.max(1, Math.round(Math.min(real, teto)));
}

/** Soma, em segundos, dos descansos válidos registrados nas séries. */
function somaDescansos(registros: RegistroExercicio[] | undefined): number {
  return (registros ?? [])
    .flatMap((r) => r.series)
    .map((s) => s.descanso)
    .filter((d): d is number => typeof d === 'number' && d > 0 && d <= DESCANSO_MAXIMO)
    .reduce((t, d) => t + d, 0);
}

/**
 * Duração da sessão em minutos: a atividade informa a sua; o treino novo traz `duracaoMin`; um treino antigo,
 * sem duração gravada, é estimado pela soma dos descansos (fica abaixo do real). Sem nada disso, `null`.
 */
export function duracaoDaSessao(s: Sessao): number | null {
  if (s.atividade) return s.atividade.minutos > 0 ? s.atividade.minutos : null;
  if (typeof s.duracaoMin === 'number' && s.duracaoMin > 0) return s.duracaoMin;
  const soma = somaDescansos(s.registros);
  return soma > 0 ? Math.max(1, Math.round(soma / 60)) : null;
}

/** Peso vigente no dia `data`: o último registro até a data; se todos forem posteriores, o mais antigo. */
export function pesoNaData(pesos: RegistroPeso[], data: string): number | null {
  if (pesos.length === 0) return null;
  const ordenados = [...pesos].sort((a, b) => a.data.localeCompare(b.data));
  const ate = ordenados.filter((p) => p.data <= data);
  return (ate.at(-1) ?? ordenados[0]).kg;
}

/** kcal ≈ MET × kg × horas, arredondado. */
export function kcal(met: number, kg: number, minutos: number): number {
  return Math.round(met * kg * (minutos / 60));
}

/** Calorias estimadas de uma sessão; `null` sem peso registrado ou sem duração. */
export function caloriasDaSessao(s: Sessao, pesos: RegistroPeso[]): number | null {
  const kg = pesoNaData(pesos, s.data);
  const minutos = duracaoDaSessao(s);
  if (kg === null || minutos === null) return null;
  if (s.atividade) return kcal(metAtividade(s.atividade), kg, minutos);

  // Cardio da ficha conta pelos minutos que a pessoa fez; o resto do tempo é musculação.
  const cardio = (s.registros ?? [])
    .filter((r) => r.unidade === 'min')
    .flatMap((r) => r.series)
    .reduce((t, x) => t + x.reps, 0);
  const minCardio = Math.min(cardio, minutos);
  const minForca = minutos - minCardio;
  const forca = (s.registros ?? []).filter((r) => r.unidade !== 'min');
  const metF = metForca(descansoMedio([{ ...s, registros: forca }]));
  return kcal(metF, kg, minForca) + kcal(MET_CARDIO_FICHA, kg, minCardio);
}

/** Soma das calorias estimadas do mês; sessões sem estimativa ficam de fora. `null` se nenhuma tem. */
export function caloriasNoMes(h: Sessao[], pesos: RegistroPeso[], ano: number, mes: number): number | null {
  let total = 0;
  let algum = false;
  for (const s of treinosNoMes(h, ano, mes)) {
    const c = caloriasDaSessao(s, pesos);
    if (c === null) continue;
    total += c;
    algum = true;
  }
  return algum ? total : null;
}

/** 237 → "235" (arredondado de 5 em 5, para não passar ideia de precisão), com separador de milhares. */
export function kcalNumero(valor: number): string {
  return Math.max(5, Math.round(valor / 5) * 5).toLocaleString('pt-BR');
}

/** 237 → "≈ 235 kcal". */
export function kcalTexto(valor: number): string {
  return `≈ ${kcalNumero(valor)} kcal`;
}
