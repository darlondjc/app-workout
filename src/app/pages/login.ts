import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CloudService } from '../core/cloud.service';
import { Carregando } from '../core/spinner';

@Component({
  selector: 'app-login',
  imports: [Carregando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="entrada">
      <img class="logo" src="icons/icon-192x192.png" width="96" height="96" alt="" />
      <h1>App <b>Workout</b></h1>
      <p class="texto">
        Monte suas fichas, registre cada treino e leve tudo com você: ao entrar, seus dados ficam guardados na
        conta e voltam em qualquer aparelho.
      </p>

      @if (!nuvem.pronto()) {
        <app-carregando texto="Verificando conta…" />
      } @else {
        <button type="button" class="google" [disabled]="nuvem.ocupado()" (click)="nuvem.entrar()">
          <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>
            <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/>
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
          </svg>
          {{ nuvem.ocupado() ? 'Entrando…' : 'Entrar com Google' }}
        </button>
        @if (nuvem.erro()) {
          <p class="erro" role="alert">{{ nuvem.erro() }}</p>
          @if (nuvem.usuario() === null && !nuvem.carregado()) {
            <button type="button" class="tentar" (click)="nuvem.iniciar()">Tentar de novo</button>
          }
        }
      }
    </section>
  `,
  styles: `
    .entrada {
      min-height: 100dvh;
      box-sizing: border-box;
      padding: 32px 28px calc(32px + env(safe-area-inset-bottom));
      background: radial-gradient(120% 80% at 50% 30%, #222a2f, #14171a 70%);
      color: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 18px;
      text-align: center;
    }
    .logo {
      border-radius: 22px;
    }
    h1 {
      font-family: var(--font-display);
      font-size: 32px;
      letter-spacing: -0.02em;
    }
    h1 b {
      color: var(--accent);
    }
    .texto {
      max-width: 320px;
      color: #c9d0ca;
      line-height: 1.45;
    }
    .google {
      min-height: 56px;
      width: 100%;
      max-width: 320px;
      border: 0;
      border-radius: 28px;
      background: #fff;
      color: #1f1f1f;
      font: inherit;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-top: 8px;
    }
    .google:disabled {
      opacity: 0.6;
    }
    .erro {
      max-width: 320px;
      font-size: 14px;
      color: #ffb4ab;
    }
    .tentar {
      background: none;
      border: 0;
      color: var(--accent);
      font: inherit;
      text-decoration: underline;
      min-height: 44px;
    }
  `,
})
export class Login {
  protected readonly nuvem = inject(CloudService);
  private readonly router = inject(Router);

  constructor() {
    void this.nuvem.iniciar();
    // Guarda para onde a pessoa queria ir (ex.: um convite): o login por redirecionamento recarrega o app e perde o endereço.
    const pedido = inject(ActivatedRoute).snapshot.queryParamMap.get('voltar');
    if (pedido && pedido.startsWith('/') && !pedido.startsWith('//')) guardarDestino(pedido);
    effect(() => {
      if (this.nuvem.usuario()) void this.router.navigateByUrl(lerDestino() ?? '/', { replaceUrl: true });
    });
  }
}

const CHAVE_DESTINO = 'app-workout:voltar';

function guardarDestino(url: string): void {
  try {
    sessionStorage.setItem(CHAVE_DESTINO, url);
  } catch {
    // sem armazenamento: o destino vale só até recarregar
  }
}

/** Destino guardado antes do login, uma vez só. */
function lerDestino(): string | null {
  try {
    const url = sessionStorage.getItem(CHAVE_DESTINO);
    sessionStorage.removeItem(CHAVE_DESTINO);
    return url;
  } catch {
    return null;
  }
}
