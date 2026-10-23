import { EmAndamento, Ficha, ItemFicha } from './models';
import { baixarImagens, idsDasFichas } from './precarga.service';

const item = (exerciseId: string): ItemFicha => ({ exerciseId, series: 3, reps: 10, carga: 0, descanso: 60 });
const ficha = (id: string, ...ex: string[]): Ficha => ({ id, nome: id, itens: ex.map(item) });
const resposta = (ok: boolean) => ({ ok }) as Response;

describe('idsDasFichas', () => {
  it('junta os exercícios de todas as fichas sem repetir', () => {
    expect(idsDasFichas([ficha('a', 'x', 'y'), ficha('b', 'y', 'z')], null)).toEqual(['x', 'y', 'z']);
  });

  it('inclui os exercícios trocados só no treino em andamento', () => {
    const andamento: EmAndamento = { fichaId: 'a', indice: 0, series: {}, iniciadoEm: 1, trocas: { '0': 'w' } };
    expect(idsDasFichas([ficha('a', 'x')], andamento)).toEqual(['x', 'w']);
  });

  it('sem fichas, não há nada para baixar', () => {
    expect(idsDasFichas([], null)).toEqual([]);
  });
});

describe('baixarImagens', () => {
  const urlsDe = (id: string) => [`${id}/0.jpg`, `${id}/anim.webp`];

  it('baixa todas as imagens de cada exercício e devolve os que ficaram completos', async () => {
    const pedidos: string[] = [];
    const prontos = await baixarImagens(['a', 'b'], urlsDe, (u) => (pedidos.push(u), Promise.resolve(resposta(true))));
    expect(prontos.sort()).toEqual(['a', 'b']);
    expect(pedidos.sort()).toEqual(['a/0.jpg', 'a/anim.webp', 'b/0.jpg', 'b/anim.webp']);
  });

  it('exercício com imagem faltando ou erro de rede não conta como pronto', async () => {
    const buscar = (u: string) => (u.startsWith('b/') ? Promise.reject(new Error('sem rede')) : Promise.resolve(resposta(!u.startsWith('c/'))));
    expect(await baixarImagens(['a', 'b', 'c'], urlsDe, buscar)).toEqual(['a']);
  });

  it('baixa poucos exercícios por vez', async () => {
    let ativos = 0;
    let maximo = 0;
    const buscar = async () => {
      ativos++;
      maximo = Math.max(maximo, ativos);
      await new Promise((r) => setTimeout(r, 2));
      ativos--;
      return resposta(true);
    };
    await baixarImagens(['a', 'b', 'c', 'd', 'e', 'f'], (id) => [id], buscar, 2);
    expect(maximo).toBeLessThanOrEqual(2);
  });
});
