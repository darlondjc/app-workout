import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import qrcode from 'qrcode-generator';
import { Avatar } from '../core/avatar';
import { Dialogo } from '../core/dialogo';
import { Icon } from '../core/icon';
import { NavegacaoService } from '../core/navegacao.service';
import { AcessoGrupo, VAGAS_GRUPO, linkDoGrupo } from '../core/social';
import { SocialService } from '../core/social.service';
import { Carregando } from '../core/spinner';

/** Convite para um grupo: compartilhar o link, copiar, mostrar QR code e escolher quem pode entrar. */
@Component({
  selector: 'app-group-invite',
  imports: [RouterLink, Avatar, Dialogo, Icon, Carregando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="topo">
        <button type="button" class="fechar" aria-label="Fechar" (click)="nav.voltar('/grupo/' + id())"><app-icon name="close" [size]="22" [stroke]="2.2" /></button>
      </header>

      @if (!social.ativo()) {
        @if (social.erro()) {
          <p class="erro" role="alert">{{ social.erro() }}</p>
        } @else {
          <app-carregando texto="Conectando…" />
        }
      } @else if (grupo(); as g) {
        <h1 class="titulo centro">{{ g.nome }}</h1>

        <div class="vagas" aria-label="Membros do grupo">
          @for (v of vagas(); track $index) {
            @if (v) {
              <a [routerLink]="v.uid === social.eu()?.uid ? '/perfil' : ['/membro', v.uid]" [attr.aria-label]="v.nome">
                <app-avatar [usuario]="{ uid: v.uid, nome: v.nome, email: '', foto: v.foto }" [tamanho]="48" />
              </a>
            } @else {
              <span class="vaga" aria-hidden="true"></span>
            }
          }
        </div>

        <h2 class="chamada centro">{{ g.membros.length === 1 ? 'Só você por enquanto' : g.membros.length + ' pessoas no grupo' }}</h2>
        <p class="apoio centro">Convide amigos para participar deste desafio.</p>

        @if (social.erro()) {
          <p class="erro" role="alert">{{ social.erro() }}</p>
        }

        @if (pedidos().length) {
          <section aria-labelledby="t-ped">
            <h2 id="t-ped" class="sub">Pedidos para entrar</h2>
            @for (p of pedidos(); track p.uid) {
              <div class="card pedido">
                <app-avatar [usuario]="{ uid: p.uid, nome: p.nome, email: '', foto: p.foto }" [tamanho]="40" />
                <strong class="nome">{{ p.nome }}</strong>
                <button type="button" class="btn btn--escuro mini" (click)="social.responderPedido(g, p.uid, true)">Aceitar</button>
                <button type="button" class="btn btn--claro mini" (click)="social.responderPedido(g, p.uid, false)">Recusar</button>
              </div>
            }
          </section>
        }

        <div class="card opcoes">
          @if (podeCompartilhar) {
            <button type="button" class="opcao" (click)="compartilhar()">
              <app-icon name="send" [size]="24" [stroke]="1.8" />
              <span class="texto"><strong>Compartilhar convite</strong><span class="apoio">Mensagens, grupos de chat, em qualquer lugar</span></span>
              <app-icon class="seta" name="chevron" [size]="18" [stroke]="2.2" />
            </button>
          }
          <button type="button" class="opcao" (click)="copiar()">
            <app-icon [name]="copiado() ? 'check' : 'link'" [size]="24" [stroke]="1.8" />
            <span class="texto"><strong>{{ copiado() ? 'Link copiado' : 'Copiar link' }}</strong><span class="apoio link">{{ link() }}</span></span>
            <app-icon class="seta" name="chevron" [size]="18" [stroke]="2.2" />
          </button>
          <button type="button" class="opcao" (click)="qrAberto.set(true)">
            <app-icon name="qr" [size]="24" [stroke]="1.8" />
            <span class="texto"><strong>Mostrar QR code</strong><span class="apoio">Para amigos que estão do seu lado</span></span>
            <app-icon class="seta" name="chevron" [size]="18" [stroke]="2.2" />
          </button>
        </div>

        <h2 class="sub">Quem pode participar</h2>
        <div class="acessos" role="radiogroup" aria-label="Quem pode participar">
          <button type="button" role="radio" class="acesso" [attr.aria-checked]="g.acesso === 'aberto'" [disabled]="!souDono()" (click)="mudarAcesso('aberto')">
            <app-icon name="link" [size]="26" [stroke]="1.8" />
            <strong>Aberto</strong>
            <span class="apoio">Qualquer pessoa com o link</span>
          </button>
          <button type="button" role="radio" class="acesso" [attr.aria-checked]="g.acesso === 'aprovado'" [disabled]="!souDono()" (click)="mudarAcesso('aprovado')">
            <app-icon name="user-check" [size]="26" [stroke]="1.8" />
            <strong>Aprovado</strong>
            <span class="apoio">Solicitar participação</span>
          </button>
        </div>
        <p class="apoio dica">
          {{ g.acesso === 'aberto' ? 'Qualquer pessoa com o link entra instantaneamente.' : 'Quem abrir o link pede para entrar e o dono do grupo aceita.' }}
          @if (!souDono()) {
            Só o dono muda isso.
          }
        </p>

        <button type="button" class="btn btn--destaque convidar" (click)="convidar()">
          <app-icon name="send" [size]="22" [stroke]="2" /> Convidar
        </button>

        <button type="button" class="sair" (click)="saindo.set(true)">Sair do grupo</button>

        @if (qrAberto()) {
          <app-dialogo titulo="QR code do convite" (fechar)="qrAberto.set(false)">
            <div class="qr" [innerHTML]="qrSvg()" role="img" [attr.aria-label]="'QR code para entrar em ' + g.nome"></div>
            <p class="apoio centro">Peça para a pessoa apontar a câmera do celular para este código.</p>
          </app-dialogo>
        }
        @if (saindo()) {
          <app-dialogo titulo="Sair do grupo?" (fechar)="saindo.set(false)">
            <p class="apoio">Você deixa de ver os treinos de {{ g.nome }} e as pessoas dele deixam de ver os seus. Para voltar, precisa de um convite.</p>
            <div class="acoes">
              <button type="button" class="btn btn--claro" (click)="saindo.set(false)">Cancelar</button>
              <button type="button" class="btn btn--escuro" (click)="sair()">Sair</button>
            </div>
          </app-dialogo>
        }
      } @else if (social.gruposCarregados()) {
        <div class="card vazio">
          <h2 class="sub">Grupo não encontrado</h2>
          <a class="btn btn--escuro" routerLink="/social">Ver meus grupos</a>
        </div>
      } @else {
        <app-carregando texto="Carregando grupo…" />
      }
    </section>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: 14px; padding-bottom: 24px; }
    .topo { display: flex; }
    .fechar { width: 44px; height: 44px; border: 0; background: none; color: var(--ink); display: flex; align-items: center; justify-content: center; margin-left: -10px; }
    .centro { text-align: center; margin: 0; }
    .titulo { overflow-wrap: anywhere; }
    .vagas { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
    .vagas a { display: flex; }
    .vaga { width: 48px; height: 48px; border-radius: 50%; border: 2px dashed var(--line); }
    .chamada { font-size: 22px; }
    .sub { font-size: 18px; margin: 4px 0 0; }
    .opcoes { padding: 0 4px; }
    .opcao { width: 100%; border: 0; background: none; font: inherit; text-align: left; color: var(--ink); display: flex; align-items: center; gap: 14px; padding: 14px 12px; min-height: 64px; }
    .opcao + .opcao { border-top: 1px solid var(--soft); }
    .opcao .texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .opcao .apoio { font-size: 14px; }
    .opcao .link { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .seta { color: var(--muted); flex: none; }
    .acessos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .acesso { border: 2px solid transparent; border-radius: 16px; background: var(--card); font: inherit; color: var(--ink); display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 16px 8px; text-align: center; }
    .acesso .apoio { font-size: 13px; }
    .acesso[aria-checked='true'] { border-color: var(--ink); }
    .acesso[aria-checked='true'] app-icon { color: var(--ink); }
    .dica { margin: 0 4px; }
    .convidar { min-height: 56px; display: flex; align-items: center; justify-content: center; gap: 10px; }
    .sair { border: 0; background: none; font: inherit; color: #b3261e; min-height: 44px; }
    .pedido { padding: 10px 12px; display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .nome { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mini { min-height: 40px; padding: 0 12px; font-size: 14px; flex: none; }
    .qr { display: flex; justify-content: center; padding: 12px; background: #fff; border-radius: 12px; margin-bottom: 12px; }
    .qr :is(svg) { width: min(260px, 100%); height: auto; }
    .acoes { display: flex; gap: 10px; margin-top: 16px; }
    .acoes .btn { flex: 1; }
    .vazio { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
    .erro { color: #b3261e; font-size: 14px; }
    button:disabled { opacity: 0.6; }
  `,
})
export class GroupInvite {
  protected readonly social = inject(SocialService);
  protected readonly nav = inject(NavegacaoService);
  private readonly router = inject(Router);

  /** Código do grupo, vindo da rota (`/grupo/:id/convidar`). */
  readonly id = input.required<string>();

  protected readonly copiado = signal(false);
  protected readonly qrAberto = signal(false);
  protected readonly saindo = signal(false);
  protected readonly podeCompartilhar = typeof navigator !== 'undefined' && !!navigator.share;

  protected readonly grupo = computed(() => this.social.grupo(this.id()));
  protected readonly souDono = computed(() => this.grupo()?.dono === this.social.eu()?.uid);
  protected readonly link = computed(() => linkDoGrupo(baseDoApp(), this.id()));

  /** Avatares dos membros e círculos tracejados para as vagas que faltam. */
  protected readonly vagas = computed(() => {
    const g = this.grupo();
    const membros = g ? this.social.membrosDe(g) : [];
    return Array.from({ length: Math.max(VAGAS_GRUPO, membros.length) }, (_, i) => membros[i] ?? null);
  });

  protected readonly pedidos = computed(() => {
    const g = this.grupo();
    if (!g || !this.souDono()) return [];
    return (g.pedidos ?? []).map((uid) => this.social.perfilDe(uid) ?? { uid, nome: 'Alguém', foto: null });
  });

  protected readonly qrSvg = computed(() => {
    const qr = qrcode(0, 'M');
    qr.addData(this.link());
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  });

  private textoConvite(): string {
    return `Entre no meu grupo "${this.grupo()?.nome ?? ''}" no App Workout!`;
  }

  protected async compartilhar(): Promise<void> {
    try {
      await navigator.share({ title: 'App Workout', text: this.textoConvite(), url: this.link() });
    } catch {
      // compartilhamento cancelado
    }
  }

  protected async copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.link());
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2500);
    } catch {
      this.social.erro.set('Não deu para copiar. Selecione o link e copie manualmente.');
    }
  }

  protected convidar(): void {
    if (this.podeCompartilhar) void this.compartilhar();
    else void this.copiar();
  }

  protected mudarAcesso(acesso: AcessoGrupo): void {
    const g = this.grupo();
    if (g && this.souDono() && g.acesso !== acesso) void this.social.definirAcesso(g, acesso);
  }

  protected async sair(): Promise<void> {
    const g = this.grupo();
    this.saindo.set(false);
    if (g && (await this.social.sairDoGrupo(g))) void this.router.navigateByUrl('/social', { replaceUrl: true });
  }
}

/** Endereço do app (com a pasta, quando publicado em um subcaminho), terminado em barra. */
export function baseDoApp(): string {
  return document.baseURI.split(/[?#]/)[0].replace(/[^/]*$/, '');
}
