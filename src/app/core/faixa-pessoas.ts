const FOLGA_PESSOAS = 4;
const LARGURA_MINIMA_PESSOA = 46;

/**
 * Largura de cada pessoa na faixa para que, com gente além da tela, sempre apareça um pedaço da próxima
 * (cabem N inteiras e meia). Só vale com 5 ou mais pessoas; devolve `null` se todas cabem ou se são poucas,
 * mantendo o layout natural. Vale para qualquer largura de tela.
 */
export function larguraDaPessoa(larguraDaFaixa: number, quantas: number): number | null {
  if (quantas < 5) return null;
  const inteiras = Math.max(2, Math.floor(larguraDaFaixa / (LARGURA_MINIMA_PESSOA + FOLGA_PESSOAS) - 0.5));
  if (quantas <= inteiras) return null;
  return larguraDaFaixa / (inteiras + 0.5) - FOLGA_PESSOAS;
}
