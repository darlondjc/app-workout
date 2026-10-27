import { MESES_MAX, MESES_MIN } from '../core/ciclo';
import { PlanService } from '../core/plan.service';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChangelogService } from '../core/changelog.service';
import { CloudService } from '../core/cloud.service';
import { Avatar } from '../core/avatar';
import { Dialogo } from '../core/dialogo';
import { FotoBotao } from '../core/foto-botao';
import { Icon } from '../core/icon';
import { PesoRegistro } from '../core/peso-registro';
import { SocialService } from '../core/social.service';
import { PreferenciaTema, TemaService } from '../core/tema.service';
import { Carregando } from '../core/spinner';
import { UpdateService } from '../core/update.service';

@Component({
  selector: 'app-settings',
  imports: [Icon, Carregando, Avatar, Dialogo, FotoBotao, PesoRegistro, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="cabeca">
        <h1 class="titulo">Perfil</h1>
        <div class="acoes-topo">
          <a class="estatisticas" routerLink="/estatisticas" aria-label="Minhas estatísticas">
            <app-icon name="chart" [size]="22" [stroke]="2.2" />
          </a>
          @if (nuvem.usuario()) {
            <button type="button" class="sair" aria-label="Sair da conta" (click)="confirmando.set(true)">
              <app-icon name="logout" [size]="22" [stroke]="2.2" />
            </button>
          }
        </div>
      </header>

      <article class="card bloco" aria-labelledby="t-conta">
        <h2 id="t-conta" class="sub">Conta</h2>
        @if (!nuvem.configurado) {
          <p class="apoio">Login indisponível nesta versão. Suas fichas e treinos ficam apenas neste aparelho.</p>
        } @else if (!nuvem.pronto()) {
          <app-carregando texto="Verificando conta…" />
        } @else if (nuvem.usuario(); as u) {
          <div class="conta">
            <button type="button" class="foto" aria-label="Ver a foto de perfil" (click)="fotoAberta.set(true)">
              <app-avatar [usuario]="social.meuUsuario() ?? u" [tamanho]="56" />
            </button>
            <div class="rot">
              <strong>{{ u.nome || u.email }}</strong>
              @if (u.nome) {
                <span class="apoio">{{ u.email }}</span>
              }
            </div>
          </div>
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

      <app-peso-registro />

      @if (social.eu(); as eu) {
        <article class="card bloco" aria-labelledby="t-priv">
          <h2 id="t-priv" class="sub">Amigos mais chegados</h2>
          <div class="troca">
            <span class="troca__txt">
              <strong>Compartilhar o gráfico de peso</strong>
              <span class="apoio">Quem você aceita como amigo mais chegado passa a ver a evolução do seu peso nas suas estatísticas. Colegas de grupo não veem.</span>
            </span>
            <button type="button" class="chave" role="switch" aria-label="Compartilhar o gráfico de peso com amigos mais chegados" [attr.aria-checked]="eu.compartilhaPeso === true" (click)="social.compartilharPeso(eu.compartilhaPeso !== true)"></button>
          </div>
        </article>
      }

      <article class="card bloco" aria-labelledby="t-tema">
        <h2 id="t-tema" class="sub">Aparência</h2>
        <div class="temas" role="radiogroup" aria-label="Tema do app">
          @for (o of temas; track o.valor) {
            <button type="button" role="radio" class="tema" [attr.aria-checked]="tema.preferencia() === o.valor" (click)="tema.definir(o.valor)">{{ o.rotulo }}</button>
          }
        </div>
        <p class="apoio">“Sistema” acompanha o modo claro ou escuro do aparelho. A escolha vale só neste aparelho.</p>
      </article>

      <article class="card bloco" aria-labelledby="t-fichas">
        <h2 id="t-fichas" class="sub">Fichas</h2>
        <div class="meses">
          <span id="rot-meses">Duração padrão de uma ficha nova</span>
          <div class="meses__ctl" role="group" aria-labelledby="rot-meses">
            <button type="button" class="meses__btn" aria-label="Diminuir um mês" [disabled]="plans.mesesPadrao() <= minMeses" (click)="plans.definirMesesPadrao(plans.mesesPadrao() - 1)">−</button>
            <output aria-live="polite">{{ plans.mesesPadrao() }} {{ plans.mesesPadrao() === 1 ? 'mês' : 'meses' }}</output>
            <button type="button" class="meses__btn" aria-label="Aumentar um mês" [disabled]="plans.mesesPadrao() >= maxMeses" (click)="plans.definirMesesPadrao(plans.mesesPadrao() + 1)">+</button>
          </div>
        </div>
        <p class="apoio">Ao fim do prazo a ficha vence; você recebe um aviso 10 dias antes. A data de cada ficha pode ser mudada nela. Vale só neste aparelho.</p>
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

        @if (log.pronto()) {
          @if (log.lista()[0]; as atual) {
            <div class="resumo">
              <p class="resumo__topo">
                <strong>{{ atual.titulo }}</strong>
                @if (atual.data) {
                  <time class="apoio" [attr.datetime]="atual.data">{{ formatar(atual.data) }}</time>
                }
              </p>
              <ul>
                @for (item of atual.itens; track item) {
                  <li>{{ item }}</li>
                }
              </ul>
            </div>
          }
          @if (anteriores().length > 0) {
            <details class="historico">
              <summary>Versões anteriores ({{ anteriores().length }})</summary>
              @for (v of anteriores(); track v.versao) {
                <details class="versao-item">
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
            </details>
          }
        } @else if (log.erro()) {
          <p class="apoio">Não foi possível carregar o histórico.</p>
          <button type="button" class="btn btn--claro" (click)="log.carregar()">Tentar de novo</button>
        } @else {
          <app-carregando texto="Carregando histórico…" />
        }
      </article>

      @if (fotoAberta()) {
        @if (nuvem.usuario(); as u) {
          <app-dialogo titulo="Foto de perfil" (fechar)="fotoAberta.set(false)">
            <div class="foto-grande">
              <app-avatar [usuario]="social.meuUsuario() ?? u" [tamanho]="240" />
            </div>
            @if (social.eu()) {
              <div class="acoes-coluna">
                <app-foto-botao [perfil]="true" rotulo="Alterar foto" (escolhida)="trocarFoto($event)" (falhou)="erroFoto.set($event)" />
                @if (social.eu()?.fotoPropria) {
                  <button type="button" class="btn btn--claro" [disabled]="salvandoFoto()" (click)="usarFotoDaConta()">Usar a foto da conta</button>
                }
              </div>
              @if (salvandoFoto()) {
                <p class="apoio" role="status">Salvando a foto…</p>
              }
              @if (erroFoto()) {
                <p class="apoio erro" role="alert">{{ erroFoto() }}</p>
              }
            }
          </app-dialogo>
        }
      }

      @if (confirmando()) {
        <app-dialogo titulo="Sair da conta?" (fechar)="confirmando.set(false)">
          <p class="apoio">Ao sair, os dados saem deste aparelho, mas continuam na sua conta. Entre de novo para recuperá-los.</p>
          <div class="acoes-linha confirma">
            <button type="button" class="btn btn--claro" (click)="confirmando.set(false)">Cancelar</button>
            <button type="button" class="btn btn--escuro" [disabled]="nuvem.ocupado()" (click)="sair()">
              {{ nuvem.ocupado() ? 'Saindo…' : 'Sair' }}
            </button>
          </div>
        </app-dialogo>
      }
    </section>
  `,
  styles: `
    .page {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .meses { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 14px; }
    .meses__ctl { display: flex; align-items: center; gap: 10px; font-weight: 700; white-space: nowrap; }
    .meses__btn { width: 44px; height: 44px; border: 2px solid var(--line); border-radius: 12px; background: var(--card); color: var(--ink); font: inherit; font-size: 20px; font-weight: 700; }
    .meses__btn:disabled { opacity: 0.4; }
    .temas { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .tema { min-height: 44px; border: 2px solid var(--line); border-radius: 12px; background: var(--card); color: var(--ink); font: inherit; font-weight: 600; }
    .tema[aria-checked='true'] { border-color: var(--ink); background: var(--soft); }
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
      background: var(--accent-soft);
    }
    .novidades {
      margin: 0;
      padding-left: 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 14px;
      line-height: 1.4;
    }
    .resumo {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .resumo__topo {
      margin: 0;
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
    }
    .resumo ul {
      margin: 0;
      padding-left: 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 14px;
      line-height: 1.4;
    }
    .historico > summary {
      min-height: 44px;
      display: flex;
      align-items: center;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      list-style: none;
    }
    .historico > summary::-webkit-details-marker {
      display: none;
    }
    .versao-item {
      border-top: 1px solid var(--soft);
    }
    .versao-item > summary {
      min-height: 52px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 0;
      cursor: pointer;
      list-style: none;
    }
    .versao-item > summary::-webkit-details-marker {
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
      margin: 0;
      padding: 0 0 14px 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 14px;
      line-height: 1.4;
    }
    .cabeca {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .troca {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .troca__txt {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 15px;
    }
    .troca__txt .apoio {
      font-size: 13px;
    }
    .chave {
      position: relative;
      flex: none;
      width: 52px;
      height: 32px;
      border: 0;
      border-radius: 999px;
      background: var(--line);
      transition: background 0.2s;
    }
    .chave::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 3px rgb(0 0 0 / 25%);
      transition: transform 0.2s;
    }
    .chave[aria-checked='true'] {
      background: var(--ink-bg);
    }
    .chave[aria-checked='true']::after {
      transform: translateX(20px);
      background: var(--accent);
    }
    .acoes-topo {
      display: flex;
      gap: 8px;
    }
    .estatisticas {
      flex: none;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--ink-bg);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sair {
      flex: none;
      width: 44px;
      height: 44px;
      border: 0;
      border-radius: 50%;
      background: #d93025;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .foto {
      flex: none;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: none;
      display: flex;
    }
    .foto-grande {
      display: flex;
      justify-content: center;
      margin-bottom: 16px;
    }
    .acoes-coluna {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .confirma {
      margin-top: 16px;
    }
    .conta {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .erro {
      color: var(--perigo);
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
  protected readonly tema = inject(TemaService);
  protected readonly temas: { valor: PreferenciaTema; rotulo: string }[] = [
    { valor: 'sistema', rotulo: 'Sistema' },
    { valor: 'claro', rotulo: 'Claro' },
    { valor: 'escuro', rotulo: 'Escuro' },
  ];
  protected readonly plans = inject(PlanService);
  protected readonly minMeses = MESES_MIN;
  protected readonly maxMeses = MESES_MAX;
  protected readonly up = inject(UpdateService);
  protected readonly log = inject(ChangelogService);
  protected readonly nuvem = inject(CloudService);
  protected readonly social = inject(SocialService);
  protected readonly confirmando = signal(false);
  protected readonly fotoAberta = signal(false);
  protected readonly anteriores = computed(() => this.log.lista().slice(1));
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
