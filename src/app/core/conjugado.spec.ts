import { blocoDoItem, blocosDe, conjugarComProximo, letraDoPar, limparPares, moverBloco, podeConjugarComProximo, removerDaLista, reordenarBlocos, separarPar } from './conjugado';
import { ItemFicha } from './models';

const item = (id: string, par?: string): ItemFicha => ({ exerciseId: id, series: 3, reps: 10, carga: 0, descanso: 60, ...(par ? { par } : {}) });
const ids = (l: ItemFicha[]) => l.map((i) => i.exerciseId).join('');

describe('conjugado', () => {
  it('blocosDe separa solos e pares', () => {
    const l = [item('a'), item('b', 'x'), item('c', 'x'), item('d')];
    expect(blocosDe(l)).toEqual([
      { tipo: 'solo', i: 0 },
      { tipo: 'par', id: 'x', a: 1, b: 2 },
      { tipo: 'solo', i: 3 },
    ]);
  });

  it('só forma pares, nunca trios: o terceiro com o mesmo id fica sozinho', () => {
    const l = [item('a', 'x'), item('b', 'x'), item('c', 'x')];
    expect(blocosDe(l).map((b) => b.tipo)).toEqual(['par', 'solo']);
    expect(limparPares(l)[2].par).toBeUndefined();
  });

  it('um par que não é vizinho vira dois solos', () => {
    const l = [item('a', 'x'), item('b'), item('c', 'x')];
    expect(blocosDe(l).map((b) => b.tipo)).toEqual(['solo', 'solo', 'solo']);
    expect(limparPares(l).every((i) => !i.par)).toBeTrue();
  });

  it('limparPares devolve a mesma lista quando está tudo certo', () => {
    const l = [item('a', 'x'), item('b', 'x')];
    expect(limparPares(l)).toBe(l);
  });

  it('podeConjugarComProximo só vale com dois solos vizinhos', () => {
    const l = [item('a'), item('b'), item('c', 'x'), item('d', 'x'), item('e')];
    expect(podeConjugarComProximo(l, 0)).toBeTrue();
    expect(podeConjugarComProximo(l, 1)).toBeFalse(); // o de baixo já está num par
    expect(podeConjugarComProximo(l, 2)).toBeFalse(); // ele mesmo já está num par
    expect(podeConjugarComProximo(l, 3)).toBeFalse();
    expect(podeConjugarComProximo(l, 4)).toBeFalse(); // não há de baixo
  });

  it('conjugar e separar são inversas, sem perder os números', () => {
    const l = [{ ...item('a'), series: 4 }, { ...item('b'), series: 2, descanso: 90 }];
    const junto = conjugarComProximo(l, 0, 'p');
    expect(junto.map((i) => i.par)).toEqual(['p', 'p']);
    expect(separarPar(junto, 1)).toEqual(l);
  });

  it('moverBloco e reordenarBlocos levam o par junto', () => {
    const l = [item('a'), item('b', 'x'), item('c', 'x'), item('d')];
    expect(ids(moverBloco(l, 1, 1))).toBe('adbc');
    expect(ids(moverBloco(l, 2, -1))).toBe('adbc');
    expect(ids(reordenarBlocos(l, 1, 0))).toBe('bcad');
    expect(moverBloco(l, 0, -1)).toBe(l);
    expect(moverBloco(l, 2, 1)).toBe(l);
  });

  it('removerDaLista deixa o outro do par sozinho', () => {
    const l = [item('a', 'x'), item('b', 'x'), item('c')];
    const r = removerDaLista(l, 0);
    expect(ids(r)).toBe('bc');
    expect(r.every((i) => !i.par)).toBeTrue();
  });

  it('blocoDoItem e letraDoPar', () => {
    const l = [item('a'), item('b', 'x'), item('c', 'x'), item('d', 'y'), item('e', 'y')];
    expect(blocoDoItem(l, 2)).toBe(1);
    expect(blocoDoItem(l, 4)).toBe(2);
    expect(letraDoPar(l, 'x')).toBe('A');
    expect(letraDoPar(l, 'y')).toBe('B');
  });
});
