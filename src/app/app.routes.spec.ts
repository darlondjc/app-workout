import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { paraStats, routes } from './app.routes';

describe('rotas das estatísticas', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('paraStats leva ao Perfil na aba Stats', () => {
    const destino = TestBed.runInInjectionContext(() => paraStats());
    expect(TestBed.inject(Router).serializeUrl(destino)).toBe('/perfil?aba=stats');
  });

  it('os caminhos antigos /estatisticas e /progresso redirecionam para a aba Stats', () => {
    for (const caminho of ['estatisticas', 'progresso']) {
      expect(routes.find((r) => r.path === caminho)?.redirectTo).toBe(paraStats);
    }
  });
});
