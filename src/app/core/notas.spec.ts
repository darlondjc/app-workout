import { NOTA_EXERCICIO_MAX, limparNota } from './notas';

describe('limparNota', () => {
  it('tira os espaços das pontas', () => {
    expect(limparNota('  ajustar o banco no 4  ', 200)).toBe('ajustar o banco no 4');
  });

  it('vazio, só espaços ou ausente viram undefined', () => {
    expect(limparNota('', 200)).toBeUndefined();
    expect(limparNota('   \n ', 200)).toBeUndefined();
    expect(limparNota(undefined, 200)).toBeUndefined();
    expect(limparNota(null, 200)).toBeUndefined();
  });

  it('corta no limite', () => {
    expect(limparNota('a'.repeat(300), NOTA_EXERCICIO_MAX)?.length).toBe(NOTA_EXERCICIO_MAX);
  });

  it('mantém as quebras de linha do meio', () => {
    expect(limparNota('um\ndois', 200)).toBe('um\ndois');
  });
});
