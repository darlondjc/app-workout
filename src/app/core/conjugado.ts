import { ItemFicha } from './models';

/**
 * Exercícios conjugados: dois exercícios vizinhos da ficha com o mesmo `par` são feitos juntos, uma série de cada
 * (a rodada). O descanso do par é o `descanso` do segundo exercício. Só existem pares (nunca trios), e cada um
 * mantém as suas séries, repetições e carga.
 */

export type Bloco = { tipo: 'solo'; i: number } | { tipo: 'par'; id: string; a: number; b: number };

/** Os blocos da lista, na ordem: cada exercício sozinho ou cada par. Um `par` sem o vizinho certo conta como sozinho. */
export function blocosDe(itens: readonly ItemFicha[]): Bloco[] {
  const blocos: Bloco[] = [];
  for (let i = 0; i < itens.length; i++) {
    const p = itens[i].par;
    if (p && itens[i + 1]?.par === p) {
      blocos.push({ tipo: 'par', id: p, a: i, b: i + 1 });
      i++;
    } else {
      blocos.push({ tipo: 'solo', i });
    }
  }
  return blocos;
}

/** Tira a marca de par de quem não forma um par de verdade (exercício removido, dado antigo ou importado com defeito). */
export function limparPares(itens: ItemFicha[]): ItemFicha[] {
  if (!itens.some((i) => i.par)) return itens;
  const emPar = new Set<number>();
  for (const b of blocosDe(itens)) if (b.tipo === 'par') emPar.add(b.a).add(b.b);
  if (itens.every((item, i) => !item.par || emPar.has(i))) return itens;
  return itens.map((item, i) => {
    if (!item.par || emPar.has(i)) return item;
    const { par: _par, ...resto } = item;
    return resto;
  });
}

/** Junta os blocos de volta numa lista de exercícios. */
function achatar(itens: readonly ItemFicha[], blocos: readonly Bloco[]): ItemFicha[] {
  return blocos.flatMap((b) => (b.tipo === 'solo' ? [itens[b.i]] : [itens[b.a], itens[b.b]]));
}

/** Número do bloco que contém o exercício da posição `indice`, ou -1. */
export function blocoDoItem(itens: readonly ItemFicha[], indice: number): number {
  return blocosDe(itens).findIndex((b) => (b.tipo === 'solo' ? b.i === indice : b.a === indice || b.b === indice));
}

/** Sobe ou desce um bloco (o par anda junto). */
export function moverBloco(itens: ItemFicha[], bloco: number, direcao: -1 | 1): ItemFicha[] {
  const blocos = blocosDe(itens);
  const alvo = bloco + direcao;
  if (bloco < 0 || bloco >= blocos.length || alvo < 0 || alvo >= blocos.length) return itens;
  [blocos[bloco], blocos[alvo]] = [blocos[alvo], blocos[bloco]];
  return achatar(itens, blocos);
}

/** Leva o bloco `de` para a posição de bloco `para` (arrastar). */
export function reordenarBlocos(itens: ItemFicha[], de: number, para: number): ItemFicha[] {
  const blocos = blocosDe(itens);
  if (de === para || de < 0 || para < 0 || de >= blocos.length || para >= blocos.length) return itens;
  const [movido] = blocos.splice(de, 1);
  blocos.splice(para, 0, movido);
  return achatar(itens, blocos);
}

/** Dá para conjugar o exercício com o de baixo: os dois existem e nenhum deles já está num par. */
export function podeConjugarComProximo(itens: readonly ItemFicha[], indice: number): boolean {
  const atual = itens[indice];
  const proximo = itens[indice + 1];
  if (!atual || !proximo) return false;
  const blocos = blocosDe(itens);
  const solo = (i: number) => blocos.some((b) => b.tipo === 'solo' && b.i === i);
  return solo(indice) && solo(indice + 1);
}

/** Forma um par com o exercício da posição `indice` e o de baixo. Sem condições para isso, devolve a lista como está. */
export function conjugarComProximo(itens: ItemFicha[], indice: number, id: string): ItemFicha[] {
  if (!podeConjugarComProximo(itens, indice)) return itens;
  return itens.map((item, i) => (i === indice || i === indice + 1 ? { ...item, par: id } : item));
}

/** Desfaz o par a que o exercício da posição `indice` pertence; cada um volta a ser sozinho, com os seus próprios números. */
export function separarPar(itens: ItemFicha[], indice: number): ItemFicha[] {
  const bloco = blocosDe(itens).find((b) => b.tipo === 'par' && (b.a === indice || b.b === indice));
  if (!bloco || bloco.tipo !== 'par') return itens;
  return itens.map((item, i) => {
    if (i !== bloco.a && i !== bloco.b) return item;
    const { par: _par, ...resto } = item;
    return resto;
  });
}

/** Tira o exercício da lista; o outro do par, se havia, fica sozinho. */
export function removerDaLista(itens: ItemFicha[], indice: number): ItemFicha[] {
  return limparPares(itens.filter((_, i) => i !== indice));
}

/** Letra do par entre os pares da lista: o primeiro é A (A1 e A2), o segundo é B, e assim por diante. */
export function letraDoPar(itens: readonly ItemFicha[], id: string): string {
  const pares = blocosDe(itens).filter((b): b is Extract<Bloco, { tipo: 'par' }> => b.tipo === 'par');
  const n = Math.max(0, pares.findIndex((b) => b.id === id));
  return String.fromCharCode(65 + (n % 26));
}
