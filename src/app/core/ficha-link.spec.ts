import { Ficha } from './models';
import { codificarFicha, codigoDoTexto, decodificarFicha, fichaParaCompartilhar, linkDaFicha, validar } from './ficha-link';

const treino = (nome: string, ids: string[]): Ficha => ({
  id: nome,
  nome,
  itens: ids.map((exerciseId, i) => ({ exerciseId, series: 3 + (i % 2), reps: 10, carga: 20.5, descanso: 60 })),
});

describe('ficha-link', () => {
  it('ida e volta: a ficha chega igual, com nome, ordem, minutos e nota', async () => {
    const t1 = treino('Peito', ['Barbell_Bench_Press_-_Medium_Grip', 'Dumbbell_Flyes']);
    t1.itens[1] = { ...t1.itens[1], nota: 'banco na posição 4' };
    const t2: Ficha = { id: 'x', nome: 'Cardio', itens: [{ exerciseId: 'Running_Treadmill', series: 1, reps: 20, unidade: 'min', carga: 0, descanso: 0 }] };
    const f = fichaParaCompartilhar('Minha divisão', [t1, t2]);
    const volta = await decodificarFicha(await codificarFicha(f));
    expect(volta).toEqual(f);
  });

  it('o código só tem caracteres seguros para o endereço', async () => {
    const codigo = await codificarFicha(fichaParaCompartilhar('A', [treino('T', ['a', 'b'])]));
    expect(codigo).toMatch(/^[zj][A-Za-z0-9_-]+$/);
    expect(linkDaFicha('https://app.exemplo/', codigo)).toBe(`https://app.exemplo/ficha-compartilhada?d=${codigo}`);
  });

  it('a compressão reduz uma ficha grande', async () => {
    const ids = Array.from({ length: 30 }, (_, i) => `Exercicio_Numero_${i}_-_Variacao`);
    const f = fichaParaCompartilhar('Grande', [treino('A', ids), treino('B', ids)]);
    const codigo = await codificarFicha(f);
    expect(codigo.length).toBeLessThan(JSON.stringify(f).length);
  });

  it('lixo, vazio e versão desconhecida viram null', async () => {
    expect(await decodificarFicha(null)).toBeNull();
    expect(await decodificarFicha('')).toBeNull();
    expect(await decodificarFicha('zzzz')).toBeNull();
    expect(await decodificarFicha('x' + btoa('{}'))).toBeNull();
    expect(await decodificarFicha('j!!!não é base64!!!')).toBeNull();
    expect(await decodificarFicha('j' + btoa('{"v":9,"n":"a","t":[]}'))).toBeNull();
    expect(await decodificarFicha('j' + btoa('não é json'))).toBeNull();
  });

  it('um código enorme é recusado sem ser aberto', async () => {
    expect(await decodificarFicha('z' + 'A'.repeat(25_000))).toBeNull();
  });

  it('valida e limita os dados que chegam', () => {
    const f = validar({
      v: 1,
      n: '  ' + 'x'.repeat(100) + '  ',
      t: [
        {
          n: '',
          i: [
            ['supino', 999, -5, 99999, 99999, 0, '  nota  '],
            ['../../etc/passwd', 3, 10, 0, 60, 0],
            [42, 3, 10, 0, 60, 0],
            ['ok', 'abc', NaN, null, undefined, 0],
            'lixo',
          ],
        },
        { n: 'vazio', i: [] },
        'lixo',
      ],
    });
    expect(f).not.toBeNull();
    expect(f!.nome.length).toBe(40);
    expect(f!.treinos.length).toBe(1);
    expect(f!.treinos[0].nome).toBe('Treino');
    const [a, b] = f!.treinos[0].itens;
    expect(f!.treinos[0].itens.length).toBe(2);
    expect(a).toEqual({ exerciseId: 'supino', series: 20, reps: 1, carga: 1000, descanso: 600, nota: 'nota' });
    expect(b).toEqual({ exerciseId: 'ok', series: 3, reps: 10, carga: 0, descanso: 60 });
  });

  it('limita a quantidade de treinos e de exercícios', () => {
    const itens = Array.from({ length: 100 }, (_, i) => [`e${i}`, 3, 10, 0, 60, 0]);
    const f = validar({ v: 1, n: 'a', t: Array.from({ length: 30 }, () => ({ n: 't', i: itens })) });
    expect(f!.treinos.length).toBe(12);
    expect(f!.treinos[0].itens.length).toBe(40);
  });

  it('sem nenhum exercício válido, não há ficha', () => {
    expect(validar({ v: 1, n: 'a', t: [{ n: 't', i: [['../x', 1, 1, 1, 1, 0]] }] })).toBeNull();
    expect(validar(null)).toBeNull();
    expect(validar('texto')).toBeNull();
  });
});

describe('codigoDoTexto', () => {
  it('tira o código de um link completo, de qualquer endereço', () => {
    expect(codigoDoTexto('https://darlondjc.github.io/app-workout/ficha-compartilhada?d=zAbc_-12')).toBe('zAbc_-12');
    expect(codigoDoTexto('  http://localhost:4200/ficha-compartilhada?x=1&d=jXyz  ')).toBe('jXyz');
  });

  it('aceita só o código', () => {
    expect(codigoDoTexto('zAbc123')).toBe('zAbc123');
  });

  it('recusa o que não parece uma ficha', () => {
    expect(codigoDoTexto('')).toBeNull();
    expect(codigoDoTexto('https://exemplo.com/outra-coisa')).toBeNull();
    expect(codigoDoTexto('olá, tudo bem?')).toBeNull();
    expect(codigoDoTexto('https://x.com/?d=aBc')).toBeNull();
    expect(codigoDoTexto('https://x.com/?d=z%')).toBeNull();
  });
});
