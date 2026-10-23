import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ChangelogService } from '../core/changelog.service';
import { CloudService } from '../core/cloud.service';
import { Avatar } from '../core/avatar';
import { FotoBotao } from '../core/foto-botao';
import { Icon } from '../core/icon';
import { SocialService } from '../core/social.service';
import { Carregando } from '../core/spinner';
import { UpdateService } from '../core/update.service';

@Component({
  selector: 'app-settings',
  imports: [Icon, Carregando, Avatar, FotoBotao],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header>
        <h1 class="titulo">Ajustes</h1>
      </header>

      <article class="card bloco" aria-labelledby="t-conta">
        <h2 id="t-conta" class="sub">Conta e backup</h2>
        @if (!nuvem.configurado) {
          <p class="apoio">Login indisponível nesta versão. Suas fichas e treinos ficam apenas neste aparelho.</p>
        } @else if (!nuvem.pronto()) {
          <app-carregando texto="Verificando conta…" />
        } @else if (nuvem.usuario(); as u) {
          <div class="conta">
            <app-avatar [usuario]="social.meuUsuario() ?? u" [tamanho]="56" />
            <div class="rot">
              <strong>{{ u.nome || u.email }}</strong>
              @if (u.nome) {
                <span class="apoio">{{ u.email }}</span>
              }
            </div>
          </div>
          @if (social.eu()) {
            <div class="acoes-linha">
              <app-foto-botao [perfil]="true" rotulo="Alterar foto" (escolhida)="trocarFoto($event)" (falhou)="erroFoto.set($event)" />
              @if (social.eu()?.fotoPropria) {
                <button type="button" class="btn btn--claro" [disabled]="salvandoFoto()" (click)="usarFotoDaConta()">Foto da conta</button>
              }
            </div>
            @if (salvandoFoto()) {
              <p class="apoio" role="status">Salvando a foto…</p>
            }
            @if (erroFoto()) {
              <p class="apoio erro" role="alert">{{ erroFoto() }}</p>
            }
          }
          <p class="status" role="status">
            @if (!nuvem.online()) {
              Sem conexão. Tudo fica salvo no aparelho e é enviado quando voltar.
            } @else {
              @switch (nuvem.status()) {
                @case ('ok') { Fichas, treinos e cargas salvos na nuvem. }
                @case ('erro') { Não foi possível sincronizar agora. }
                @default { Sincronizando… }
              }
            }
          </p>
          @if (nuvem.erro()) {
            <p class="apoio erro" role="alert">{{ nuvem.erro() }}</p>
          }
          @if (confirmando()) {
            <p class="apoio">Ao sair, os dados saem deste aparelho, mas continuam na sua conta. Entre de novo para recuperá-los.</p>
            <div class="acoes-linha">
              <button type="button" class="btn btn--claro" (click)="confirmando.set(false)">Cancelar</button>
              <button type="button" class="btn btn--escuro" [disabled]="nuvem.ocupado()" (click)="sair()">
                {{ nuvem.ocupado() ? 'Saindo…' : 'Sair' }}
              </button>
            </div>
          } @else {
            <button type="button" class="btn btn--claro" (click)="confirmando.set(true)">Sair da conta</button>
          }
        } @else {
          <p class="apoio">
            Entre com o Google para guardar fichas, treinos, cargas e treino em andamento na nuvem. Se trocar de
            aparelho ou reinstalar o app, é só entrar de novo para recuperar tudo.
          </p>
          @if (nuvem.erro()) {
            <p class="apoio erro" role="alert">{{ nuvem.erro() }}</p>
          }
          <button type="button" class="btn btn--escuro" [disabled]="nuvem.ocupado()" (click)="nuvem.entrar()">
            {{ nuvem.ocupado() ? 'Entrando…' : 'Entrar com Google' }}
          </button>
        }
      </article>

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
    .conta {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .erro {
      color: #b3261e;
    }
    .acoes-linha {
      display: flex;
      gap: 10px;
    }
    .acoes-linha .btn,
    .acoes-linha app-foto-botao {
      flex: 1;
    }
    button:disabled {
      opacity: 0.6;
    }
  `,
})
export class Settings {
  protected readonly up = inject(UpdateService);
  protected readonly log = inject(ChangelogService);
  protected readonly nuvem = inject(CloudService);
  protected readonly social = inject(SocialService);
  protected readonly confirmando = signal(false);
  protected readonly erroFoto = signal('');
  protected readonly salvandoFoto = signal(false);

  constructor() {
    void this.nuvem.iniciar();
  }

  protected async trocarFoto(dados: string): Promise<void> {
    await this.salvarFoto(() => this.social.trocarFoto(dados));
  }

  protected async usarFotoDaConta(): Promise<void> {
    await this.salvarFoto(() => this.social.usarFotoDaConta());
  }

  private async salvarFoto(acao: () => Promise<void>): Promise<void> {
    this.erroFoto.set('');
    this.salvandoFoto.set(true);
    try {
      await acao();
    } catch {
      this.erroFoto.set('Não consegui salvar a foto. Confira a conexão e tente de novo.');
    } finally {
      this.salvandoFoto.set(false);
    }
  }

  protected async sair(): Promise<void> {
    await this.nuvem.sair();
    this.confirmando.set(false);
  }

  protected formatar(iso: string): string {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
