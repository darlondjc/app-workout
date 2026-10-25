import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { logado } from '../core/auth.guard';
import { CloudService } from '../core/cloud.service';
import { Login } from './login';

@Component({ template: 'convite' })
class ConviteFalso {}

@Component({ template: 'início' })
class InicioFalso {}

describe('Login a partir de um link de convite', () => {
  let usuario: ReturnType<typeof signal<{ uid: string } | null>>;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    sessionStorage.clear();
    usuario = signal<{ uid: string } | null>(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', pathMatch: 'full', canActivate: [logado], component: InicioFalso },
          { path: 'convite/:codigo', canActivate: [logado], component: ConviteFalso },
          { path: 'entrar', component: Login },
        ]),
        {
          provide: CloudService,
          useValue: {
            configurado: true,
            usuario,
            pronto: signal(true),
            ocupado: signal(false),
            erro: signal(''),
            carregado: () => true,
            iniciar: () => Promise.resolve(),
            aguardarPronto: () => Promise.resolve(),
            entrar: () => Promise.resolve(),
          },
        },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => sessionStorage.clear());

  it('sem login, o convite manda para a tela de entrar guardando para onde voltar', async () => {
    await harness.navigateByUrl('/convite/ABCD2345');
    expect(TestBed.inject(Router).url).toBe('/entrar?voltar=%2Fconvite%2FABCD2345');
  });

  it('depois de entrar, a pessoa volta para o convite (que a leva ao grupo)', async () => {
    await harness.navigateByUrl('/convite/ABCD2345');
    usuario.set({ uid: 'nova' });
    TestBed.tick();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/convite/ABCD2345');
  });

  it('o destino sobrevive a um login por redirecionamento (a página recarrega e perde o endereço)', async () => {
    await harness.navigateByUrl('/convite/ABCD2345');
    expect(sessionStorage.getItem('app-workout:voltar')).toBe('/convite/ABCD2345');
  });

  it('sem convite no caminho, entrar leva ao início', async () => {
    await harness.navigateByUrl('/');
    expect(TestBed.inject(Router).url).toBe('/entrar');
    usuario.set({ uid: 'nova' });
    TestBed.tick();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('ignora destinos que não são do próprio app', async () => {
    await harness.navigateByUrl('/entrar?voltar=https://outro.site/x');
    usuario.set({ uid: 'nova' });
    TestBed.tick();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/');
  });
});
