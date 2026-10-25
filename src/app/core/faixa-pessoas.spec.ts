import { larguraDaPessoa } from './faixa-pessoas';

describe('larguraDaPessoa', () => {
  it('não mexe na largura quando todos cabem', () => {
    expect(larguraDaPessoa(360, 3)).toBeNull();
  });
  it('com até 4 pessoas, mantém o layout natural em qualquer largura', () => {
    expect(larguraDaPessoa(200, 4)).toBeNull();
    expect(larguraDaPessoa(300, 4)).toBeNull();
  });
  it('seis pessoas cabem inteiras em uma tela de celular, sem precisar rolar', () => {
    expect(larguraDaPessoa(332, 6)).toBeNull();
  });
  it('com sete pessoas em tela estreita, deixa meia pessoa à mostra', () => {
    expect(larguraDaPessoa(332, 7)).not.toBeNull();
  });
  it('com gente além da tela, deixa meia pessoa à mostra', () => {
    const w = larguraDaPessoa(332, 8)!;
    const passo = w + 4;
    expect((332 / passo) % 1).toBeCloseTo(0.5, 5);
  });
});
