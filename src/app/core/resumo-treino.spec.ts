import { TestBed } from '@angular/core/testing';
import { DadosResumo, ResumoTreino } from './resumo-treino';

function montar(dados: DadosResumo) {
  const fixture = TestBed.createComponent(ResumoTreino);
  fixture.componentRef.setInput('dados', dados);
  fixture.detectChanges();
  return fixture;
}

const base: DadosResumo = { nome: 'Peito e Tríceps', exercicios: 2, series: 7, volume: 2840, medalhas: [] };

describe('ResumoTreino', () => {
  it('mostra o nome do treino, os números e o botão OK', () => {
    const el: HTMLElement = montar(base).nativeElement;
    const texto = el.textContent ?? '';
    expect(texto).toContain('Peito e Tríceps');
    expect(texto).toContain('Exercícios');
    expect(texto).toContain('7');
    expect(texto).toContain('2.840');
    expect(el.querySelector('button.ok')?.textContent).toContain('OK');
  });

  it('sem medalhas novas, não mostra a faixa de medalhas', () => {
    expect(montar(base).nativeElement.querySelector('.faixa')).toBeNull();
  });

  it('esconde a carga total quando o treino não teve carga', () => {
    const el: HTMLElement = montar({ ...base, volume: 0 }).nativeElement;
    expect(el.textContent).not.toContain('Carga total');
  });

  it('mostra as calorias estimadas com ≈, quando há estimativa', () => {
    const el: HTMLElement = montar({ ...base, kcal: 237 }).nativeElement;
    expect(el.textContent).toContain('Calorias');
    expect(el.textContent).toContain('≈ 235');
    expect(el.textContent).not.toContain('Registre seu peso');
  });

  it('sem estimativa, não mostra calorias; sem peso registrado, convida a registrar', () => {
    const el: HTMLElement = montar({ ...base, kcal: null, semPeso: true }).nativeElement;
    expect(el.textContent).not.toContain('Calorias');
    expect(el.textContent).toContain('Registre seu peso no Perfil');
  });

  it('lista as medalhas novas e usa o singular quando é uma só', () => {
    const uma: HTMLElement = montar({ ...base, medalhas: [{ titulo: 'Treinos', nivel: 'bronze' }] }).nativeElement;
    expect(uma.querySelectorAll('.item').length).toBe(1);
    expect(uma.textContent).toContain('Medalha nova');
    const varias: HTMLElement = montar({ ...base, medalhas: [{ titulo: 'Treinos', nivel: 'prata' }, { titulo: 'Recordes', nivel: 'ouro' }, { titulo: 'Cardio', nivel: 'bronze' }, { titulo: 'Inferiores', nivel: 'bronze' }] }).nativeElement;
    expect(varias.querySelectorAll('.item').length).toBe(4);
    expect(varias.textContent).toContain('Medalhas novas');
  });

  it('OK, X e toque fora emitem o mesmo evento de fechar', () => {
    const fixture = montar(base);
    let vezes = 0;
    fixture.componentInstance.ok.subscribe(() => vezes++);
    (fixture.nativeElement.querySelector('button.ok') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('button.x') as HTMLButtonElement).click();
    expect(vezes).toBe(2);
  });
});
