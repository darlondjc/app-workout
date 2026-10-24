import { duracaoTexto, lerNumero, resumoAtividade } from './atividade';

describe('atividade', () => {
  it('duracaoTexto usa horas quando passa de 60 minutos', () => {
    expect(duracaoTexto(45)).toBe('45 min');
    expect(duracaoTexto(60)).toBe('1 h');
    expect(duracaoTexto(75)).toBe('1 h 15 min');
  });

  it('resumoAtividade junta distância, duração e esforço', () => {
    expect(resumoAtividade({ tipo: 'corrida', nome: 'Corrida', minutos: 31, distanciaKm: 5.2, esforco: 'moderado' })).toBe('5,2 km · 31 min · Moderado');
    expect(resumoAtividade({ tipo: 'tenis', nome: 'Tênis', minutos: 90 })).toBe('1 h 30 min');
  });

  it('lerNumero aceita vírgula e rejeita texto', () => {
    expect(lerNumero('5,2')).toBe(5.2);
    expect(lerNumero(' 40 ')).toBe(40);
    expect(lerNumero('')).toBeNull();
    expect(lerNumero('abc')).toBeNull();
  });
});
