import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { codigoDoTexto } from '../core/ficha-link';
import { Icon } from '../core/icon';
import { NavegacaoService } from '../core/navegacao.service';

/**
 * Importar uma ficha colando o link (ou só o código). Serve para quem usa o app instalado: abrir o link
 * fora dele pode cair no navegador, e aqui a ficha abre sem sair do app.
 */
@Component({
  selector: 'app-import-plan',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header>
        <button type="button" class="voltar" (click)="nav.voltar('/fichas/nova')"><app-icon name="back" [size]="18" [stroke]="2.2" /> Voltar</button>
        <h1 class="titulo">Importar ficha</h1>
        <p class="apoio">Cole o link que você recebeu. Você vê a ficha antes de adicionar.</p>
      </header>

      <form (submit)="$event.preventDefault(); abrir()">
        <label for="link-ficha" class="sr-only">Link da ficha</label>
        <textarea id="link-ficha" rows="4" placeholder="https://…/ficha-compartilhada?d=…" [value]="texto()" (input)="digitar($any($event.target).value)"></textarea>
        @if (erro()) {
          <p class="erro" role="alert">{{ erro() }}</p>
        }
        <div class="acoes">
          @if (podeColar) {
            <button type="button" class="btn btn--claro" (click)="colar()">Colar</button>
          }
          <button type="submit" class="btn btn--escuro">Ver ficha</button>
        </div>
      </form>
    </section>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: 14px; }
    header .apoio { margin: 0; }
    .voltar { border: 0; background: none; padding: 0; font: inherit; font-size: 14px; display: inline-flex; align-items: center; gap: 4px; min-height: 44px; color: var(--muted); }
    form { display: flex; flex-direction: column; gap: 10px; }
    textarea { width: 100%; box-sizing: border-box; padding: 12px; border: 2px solid var(--line); border-radius: 14px; background: var(--card); color: var(--ink); font: inherit; font-size: 14px; resize: vertical; overflow-wrap: anywhere; }
    .erro { margin: 0; color: var(--perigo); font-size: 14px; }
    .acoes { display: flex; gap: 10px; }
    .acoes .btn { flex: 1; }
  `,
})
export class ImportPlan {
  protected readonly nav = inject(NavegacaoService);
  private readonly router = inject(Router);

  protected readonly texto = signal('');
  protected readonly erro = signal('');
  protected readonly podeColar = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;

  protected digitar(v: string): void {
    this.texto.set(v);
    this.erro.set('');
  }

  protected async colar(): Promise<void> {
    try {
      this.digitar(await navigator.clipboard.readText());
    } catch {
      this.erro.set('Não deu para ler a área de transferência. Cole o texto no campo.');
    }
  }

  protected abrir(): void {
    const codigo = codigoDoTexto(this.texto());
    if (!codigo) {
      this.erro.set('Esse texto não parece um link de ficha. Confira se copiou o link inteiro.');
      return;
    }
    void this.router.navigate(['/ficha-compartilhada'], { queryParams: { d: codigo } });
  }
}
