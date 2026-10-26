/** Nota fixa de um exercício na ficha (vale em todos os treinos). */
export const NOTA_EXERCICIO_MAX = 200;
/** Nota de um treino concluído (aparece no detalhe e na timeline). */
export const NOTA_TREINO_MAX = 300;

/** Tira espaços das pontas e corta no limite. Texto vazio vira `undefined`, para o campo nem ser gravado. */
export function limparNota(texto: string | undefined | null, maximo: number): string | undefined {
  const t = (texto ?? '').trim().slice(0, maximo).trim();
  return t === '' ? undefined : t;
}
