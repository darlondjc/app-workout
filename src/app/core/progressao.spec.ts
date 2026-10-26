import { RegistroExercicio } from './models';
import { passoDeCarga, sugerirCarga } from './progressao';

const item = { series: 3, reps: 10 };
const reg = (series: [number, number][], unidade?: 'min'): RegistroExercicio => ({
  exerciseId: 'supino',
  unidade,
  series: series.map(([carga, reps]) => ({ carga, reps })),
});

describe('progressão de carga', () => {
  describe('passoDeCarga', () => {
    it('sobe cerca de 5%, entre 1 e 5 kg, em passos de 0,5', () => {
      expect(passoDeCarga(10)).toBe(1);
      expect(passoDeCarga(20)).toBe(1);
      expect(passoDeCarga(40)).toBe(2);
      expect(passoDeCarga(60)).toBe(3);
      expect(passoDeCarga(100)).toBe(5);
      expect(passoDeCarga(300)).toBe(5);
    });
  });

  describe('sugerirCarga', () => {
    it('todas as séries e repetições feitas com a mesma carga: sugere subir', () => {
      expect(sugerirCarga(item, reg([[40, 10], [40, 10], [40, 10]]))).toEqual({ de: 40, para: 42 });
    });

    it('repetições acima da meta também contam', () => {
      expect(sugerirCarga(item, reg([[40, 12], [40, 11], [40, 10]]))).toEqual({ de: 40, para: 42 });
    });

    it('carga com meio quilo continua em passos de 0,5', () => {
      expect(sugerirCarga(item, reg([[22.5, 10], [22.5, 10], [22.5, 10]]))).toEqual({ de: 22.5, para: 23.5 });
    });

    it('uma série abaixo da meta: repete a carga', () => {
      expect(sugerirCarga(item, reg([[40, 10], [40, 10], [40, 8]]))).toBeNull();
    });

    it('menos séries do que a ficha pede: não sugere', () => {
      expect(sugerirCarga(item, reg([[40, 10], [40, 10]]))).toBeNull();
    });

    it('cargas diferentes entre as séries (pirâmide): não sugere', () => {
      expect(sugerirCarga(item, reg([[30, 10], [40, 10], [50, 10]]))).toBeNull();
    });

    it('sem registro anterior: não sugere', () => {
      expect(sugerirCarga(item, undefined)).toBeNull();
    });

    it('exercício em minutos ou sem carga: não sugere', () => {
      expect(sugerirCarga({ ...item, unidade: 'min' }, reg([[0, 20]]))).toBeNull();
      expect(sugerirCarga(item, reg([[0, 10], [0, 10], [0, 10]]))).toBeNull();
      expect(sugerirCarga(item, reg([[10, 20]], 'min'))).toBeNull();
    });

    it('mais séries do que o previsto não atrapalha', () => {
      expect(sugerirCarga(item, reg([[40, 10], [40, 10], [40, 10], [40, 10]]))).toEqual({ de: 40, para: 42 });
    });
  });
});
