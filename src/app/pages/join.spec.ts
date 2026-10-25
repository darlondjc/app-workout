import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SocialService } from '../core/social.service';
import { Join } from './join';

@Component({ template: 'grupo' })
class GrupoFalso {}

describe('Join (link de convite de grupo)', () => {
  let ativo: ReturnType<typeof signal<boolean>>;
  let resultado: unknown;
  let entrar: jasmine.Spy;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    ativo = signal(false);
    entrar = jasmine.createSpy('entrarPorCodigo').and.callFake(() => Promise.resolve(resultado));
    TestBed.configureTestingModule({
      providers: [
        // Como no app: o parâmetro da rota chega ao componente como entrada.
        provideRouter(
          [
            { path: 'convite/:codigo', component: Join },
            { path: 'grupo/:id', component: GrupoFalso },
          ],
          withComponentInputBinding(),
        ),
        { provide: SocialService, useValue: { ativo, entrarPorCodigo: entrar } },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  /** Abre o link com a conta social já pronta (a tela só age quando ela está pronta). */
  async function abrir(): Promise<void> {
    ativo.set(true);
    await harness.navigateByUrl('/convite/ABCD2345');
    for (let i = 0; i < 3; i++) {
      harness.detectChanges();
      await harness.fixture.whenStable();
      await new Promise((r) => setTimeout(r));
    }
  }

  it('grupo aberto: entra e vai direto para a tela do grupo', async () => {
    resultado = { estado: 'entrou', grupo: { id: 'ABCD2345' } };
    await abrir();
    expect(entrar).toHaveBeenCalledOnceWith('ABCD2345');
    expect(TestBed.inject(Router).url).toBe('/grupo/ABCD2345');
  });

  it('quem já é membro também vai para a tela do grupo', async () => {
    resultado = { estado: 'ja-membro', grupo: { id: 'ABCD2345' } };
    await abrir();
    expect(TestBed.inject(Router).url).toBe('/grupo/ABCD2345');
  });

  it('grupo com aprovação: fica na tela do convite avisando que o pedido foi enviado', async () => {
    resultado = { estado: 'pedido-enviado', grupo: { id: 'ABCD2345', nome: 'Trabalho' } };
    await abrir();
    expect(TestBed.inject(Router).url).toBe('/convite/ABCD2345');
    expect(harness.routeNativeElement?.textContent).toContain('Pedido enviado');
  });

  it('espera a conta social ficar pronta antes de entrar no grupo', async () => {
    resultado = { estado: 'entrou', grupo: { id: 'ABCD2345' } };
    await harness.navigateByUrl('/convite/ABCD2345');
    harness.detectChanges();
    expect(entrar).not.toHaveBeenCalled();
  });
});
