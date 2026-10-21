import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ChangelogService } from '../core/changelog.service';
import { Icon } from '../core/icon';
import { Carregando } from '../core/spinner';
import { UpdateService } from '../core/update.service';

@Component({
  selector: 'app-settings',
  imports: [Icon, Carregando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header>
        <h1 class="titulo">Ajustes</h1>
      </header>

      <article class="card bloco" aria-labelledby="t-versao">
        <h2 id="t-versao" class="sub">Versão do app</h2>
        <p class="versao">
          @if (log.versaoAtual(); as v) {
            {{ v }}
          } @else {
            —
          }
        </p>

        @if (!up.disponivel) {
          <p class="apoio">
            As atualizações automáticas funcionam no app publicado e instalado. Neste modo elas ficam desligadas.
          </p>
        } @else if (up.pronta(); as nova) {
          <p class="status status--nova" role="status">
            <strong>Nova versão {{ nova.versao }} disponível.</strong>
            @if (nova.titulo) {
              {{ nova.titulo }}
            }
          </p>
          @if (nova.novidades.length) {
            <ul class="novidades">
              @for (n of nova.novidades; track n) {
                <li>{{ n }}</li>
              }
            </ul>
          }
          <button type="button" class="btn btn--escuro" [disabled]="up.atualizando()" (click)="up.atualizar()">
            <app-icon name="refresh" [size]="20" [stroke]="2.2" />
            {{ up.atualizando() ? 'Atualizando…' : 'Atualizar agora' }}
          </button>
        } @else {
          <p class="status" role="status">
            @if (up.verificando()) {
              Procurando atualização…
            }
            @switch (up.ultimaVerificacao()) {
              @case ('atual') {
                Você está com a versão mais recente.
              }
              @case ('erro') {
                Não foi possível verificar. Confira a conexão e tente de novo.
              }
              @case (null) {
                @if (!up.verificando()) {
                  Verificamos sozinhos de tempos em tempos.
                }
              }
            }
          </p>
          <button type="button" class="btn btn--claro" [disabled]="up.verificando()" (click)="up.verificar()">
            <app-icon name="refresh" [size]="20" [stroke]="2.2" />
            {{ up.verificando() ? 'Verificando…' : 'Verificar atualizações' }}
          </button>
        }
        @if (up.falhou()) {
          <p class="apoio">A última atualização não pôde ser baixada. Tentaremos de novo.</p>
        }
      </article>

      <section aria-labelledby="t-hist">
        <h2 id="t-hist" class="sub">O que mudou</h2>
        @if (log.pronto()) {
          <div class="historico">
            @for (v of log.lista(); track v.versao; let i = $index) {
              <details class="card versao-item" [open]="i === 0">
                <summary>
                  <span class="rot">
                    <strong>{{ v.versao }}</strong>
                    <span class="apoio">{{ v.titulo }}</span>
                  </span>
                  @if (v.data) {
                    <time class="apoio" [attr.datetime]="v.data">{{ formatar(v.data) }}</time>
                  }
                </summary>
                <ul>
                  @for (item of v.itens; track item) {
                    <li>{{ item }}</li>
                  }
                </ul>
              </details>
            }
          </div>
        } @else if (log.erro()) {
          <p class="apoio">Não foi possível carregar o histórico.</p>
          <button type="button" class="btn btn--claro" (click)="log.carregar()">Tentar de novo</button>
        } @else {
          <app-carregando texto="Carregando histórico…" />
        }
      </section>
    </section>
  `,
  styles: `
    .page {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .bloco {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .sub {
      font-size: 18px;
      margin-bottom: 8px;
    }
    .bloco .sub {
      margin: 0;
      font-size: 15px;
      color: var(--muted);
      font-weight: 500;
    }
    .versao {
      font-family: var(--font-display);
      font-size: 32px;
      font-weight: 700;
      line-height: 1;
    }
    .status {
      font-size: 14px;
    }
    .status--nova {
      padding: 10px 12px;
      border-radius: 12px;
      background: #f1f8cf;
    }
    .novidades,
    .versao-item ul {
      margin: 0;
      padding-left: 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 14px;
      line-height: 1.4;
    }
    .historico {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .versao-item {
      padding: 4px 16px;
    }
    summary {
      min-height: 52px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 0;
      cursor: pointer;
      list-style: none;
    }
    summary::-webkit-details-marker {
      display: none;
    }
    time {
      flex: none;
      white-space: nowrap;
      font-size: 13px;
    }
    .rot {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .versao-item ul {
      padding-bottom: 14px;
    }
    button:disabled {
      opacity: 0.6;
    }
  `,
})
export class Settings {
  protected readonly up = inject(UpdateService);
  protected readonly log = inject(ChangelogService);

  protected formatar(iso: string): string {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
