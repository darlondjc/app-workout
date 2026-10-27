import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Avatar } from '../core/avatar';
import { Dialogo } from '../core/dialogo';
import { Icon } from '../core/icon';
import { MedalhasGaleria } from '../core/medalhas-galeria';
import { MedalhasService } from '../core/medalhas.service';
import { MedalhasFaixa } from '../core/medalhas-faixa';
import { TipoConquista, ordenarPorNivel } from '../core/medalhas';
import { NavegacaoService } from '../core/navegacao.service';
import { SocialService } from '../core/social.service';
import { Carregando } from '../core/spinner';
import { EventoCard } from './evento-card';
import { Progress } from './progress';

type Aba = 'timeline' | 'estatisticas';

/**
 * Uma pessoa, aberta ao tocar no ícone dela. Colega de grupo: só as estatísticas. Amigo mais chegado: duas abas
 * (timeline dela e estatísticas), e as estatísticas ganham o que ela deixou à mostra, como o gráfico de peso.
 */
@Component({
  selector: 'app-member-stats',
  imports: [RouterLink, Avatar, Dialogo, Icon, MedalhasGaleria, MedalhasFaixa, Carregando, EventoCard, Progress],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page" [class.page--abas]="amigo()">
      <header class="cabeca">
        <button type="button" class="voltar" aria-label="Voltar" (click)="nav.voltar('/social')"><app-icon name="back" [size]="20" [stroke]="2.2" /></button>
        @if (perfil(); as p) {
          <app-avatar [usuario]="{ uid: p.uid, nome: p.nome, email: '', foto: p.foto }" [tamanho]="44" />
          <div class="quem">
            <h1 class="titulo nome">{{ p.nome }}</h1>
            @if (amigo()) {
              <span class="apoio etiqueta">Amigo mais chegado</span>
            }
          </div>
        }
      </header>

      @if (!social.ativo()) {
        @if (social.erro()) {
          <p class="erro" role="alert">{{ social.erro() }}</p>
        } @else {
          <app-carregando texto="Conectando…" />
        }
      } @else if (!social.conexoesCarregadas() || !social.amizadesCarregadas()) {
        <app-carregando texto="Carregando…" />
      } @else if (!social.podeVer(uid())) {
        <div class="card vazio">
          <h2 class="sub">Estatísticas indisponíveis</h2>
          <p class="apoio">Você só vê as estatísticas de quem está em um grupo com você ou é seu amigo mais chegado.</p>
          <a class="btn btn--escuro" routerLink="/social">Voltar ao Social</a>
        </div>
      } @else {
        @if (!amigo()) {
          <div class="card pedir">
            @switch (estadoAmizade()) {
              @case ('pedido-enviado') {
                <p class="apoio">Pedido de amizade enviado. Falta {{ primeiroNome() }} aceitar.</p>
                <button type="button" class="btn btn--claro mini" (click)="cancelarPedido()">Cancelar pedido</button>
              }
              @case ('pedido-recebido') {
                <p class="apoio">{{ primeiroNome() }} quer ser seu amigo mais chegado.</p>
                <button type="button" class="btn btn--escuro mini" [disabled]="enviando()" (click)="pedirAmizade()">Aceitar</button>
              }
              @default {
                <p class="apoio">Amigos mais chegados veem a timeline um do outro e as estatísticas que cada um deixar à mostra.</p>
                <button type="button" class="btn btn--escuro mini" [disabled]="enviando()" (click)="pedirAmizade()">
                  <app-icon name="user-add" [size]="18" [stroke]="2" /> Adicionar aos amigos mais chegados
                </button>
              }
            }
          </div>
        }

        @if (social.erro()) {
          <p class="erro" role="alert">{{ social.erro() }}</p>
        }

        @if (amigo() && aba() === 'timeline') {
          @for (item of itens(); track item.chave) {
            @if (item.tipo === 'evento') {
              <app-evento-card [evento]="item.evento" />
            }
          } @empty {
            <div class="card vazio">
              <h2 class="sub">Nada por aqui ainda</h2>
              <p class="apoio">Os treinos concluídos de {{ primeiroNome() }} aparecem aqui.</p>
            </div>
          }
          @if (temMais() && itens().length > 0) {
            <div #fim class="fim-lista" role="status">
              <app-carregando texto="Carregando mais treinos…" />
              <button type="button" class="btn btn--claro" (click)="social.carregarMaisDePessoa(uid())">Carregar mais</button>
            </div>
          }
        } @else if (carregado()) {
          <app-progress [historico]="sessoes()" [editavel]="false" [calendarioPrimeiro]="true" [nome]="primeiroNome()" [metaBase]="perfil()?.metaSemanal" [pesos]="pesos()">
            <section class="medalhas" aria-labelledby="t-med">
              <div class="medalhas__topo">
                <h2 id="t-med" class="sub">Medalhas</h2>
                <button type="button" class="ver-todas" aria-haspopup="dialog" (click)="abrirGaleria(null)">Ver todas</button>
              </div>
              <app-medalhas-faixa [conquistas]="conquistas()" (abrir)="abrirGaleria($event)" />
            </section>
          </app-progress>
          @if (amigo()) {
            @if (confirmandoRemocao()) {
              <div class="card pedir">
                <p class="apoio">Desfazer a amizade com {{ primeiroNome() }}? Vocês deixam de ver o que só amigos veem.</p>
                <div class="linha-botoes">
                  <button type="button" class="btn btn--claro mini" (click)="confirmandoRemocao.set(false)">Cancelar</button>
                  <button type="button" class="btn btn--escuro mini" (click)="desfazer()">Desfazer</button>
                </div>
              </div>
            } @else {
              <button type="button" class="desfazer" (click)="confirmandoRemocao.set(true)">Desfazer amizade</button>
            }
          }
        } @else {
          <app-carregando texto="Carregando treinos…" />
        }

        @if (amigo()) {
          <div class="abas-fixas">
            <div class="abas-sociais" role="tablist" aria-label="Seção">
              <button type="button" role="tab" [attr.aria-selected]="aba() === 'timeline'" (click)="aba.set('timeline')"><app-icon name="feed" [size]="18" [stroke]="2.2" /> Timeline</button>
              <button type="button" role="tab" [attr.aria-selected]="aba() === 'estatisticas'" (click)="aba.set('estatisticas')"><app-icon name="chart" [size]="18" [stroke]="2.2" /> Estatísticas</button>
            </div>
          </div>
        }
      }

      @if (galeriaAberta()) {
        <app-dialogo titulo="Medalhas" [subtitulo]="resumoConquistas()" (fechar)="galeriaAberta.set(false)">
          <app-medalhas-galeria [conquistas]="conquistas()" [foco]="foco()" />
        </app-dialogo>
      }
    </section>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: 16px; }
    /* Com as abas fixas embaixo, espaço para o conteúdo não ficar escondido atrás delas (altura delas: 50 px). */
    .page--abas { gap: 10px; padding-bottom: 0; min-height: calc(100dvh - 84px - env(safe-area-inset-bottom, 0px)); }
    .cabeca { display: flex; align-items: center; gap: 10px; }
    .voltar { flex: none; width: 44px; height: 44px; border: 0; border-radius: 50%; background: var(--soft); color: var(--ink); display: flex; align-items: center; justify-content: center; }
    .quem { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .nome { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 24px; }
    .etiqueta { font-size: 12px; }
    .vazio { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
    .pedir { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
    .pedir .apoio { margin: 0; }
    .mini { min-height: 40px; padding: 0 14px; font-size: 14px; display: inline-flex; align-items: center; gap: 8px; }
    .linha-botoes { display: flex; gap: 8px; }
    .sub { font-size: 18px; margin: 0; }
    .medalhas { display: flex; flex-direction: column; gap: 10px; }
    .medalhas__topo { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .ver-todas { min-height: 32px; padding: 0; border: 0; background: none; font: inherit; font-size: 14px; font-weight: 700; color: var(--accent-ink); }
    .desfazer { border: 0; background: none; font: inherit; color: var(--perigo); min-height: 44px; }
    .fim-lista { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 8px 0 16px; min-height: 64px; }
    .fim-lista .btn { min-height: 40px; font-size: 14px; }
    /* Abas sempre à vista, coladas acima da barra de navegação (73 px + a área segura do aparelho). Ficam coladas na rolagem (sticky) em vez de fixas: com pouco conteúdo ficam no pé da tela e no fim da página sentam no lugar delas, sem cobrir nada (11 px = folga que o <main> deixa acima da barra de navegação). */
    .abas-fixas { position: sticky; z-index: 9; bottom: calc(73px + env(safe-area-inset-bottom, 0px)); margin: auto -20px -11px; box-sizing: border-box; padding: 6px 20px; background: color-mix(in srgb, var(--card) 96%, transparent); -webkit-backdrop-filter: saturate(1.4) blur(14px); backdrop-filter: saturate(1.4) blur(14px); box-shadow: 0 -1px 0 var(--line); }
    /* Dois botões separados, cada um com o seu fundo e um vão entre eles. */
    .abas-sociais { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
    .abas-sociais button { min-height: 38px; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 6px; border: 0; border-radius: 12px; background: var(--soft); font: inherit; font-size: 14px; font-weight: 600; color: var(--muted); white-space: nowrap; }
    /* A aba escolhida fica escura, com letra branca: aparece bem mesmo de relance. */
    .abas-sociais button[aria-selected='true'] { background: var(--ink-bg); color: #fff; }
    .erro { color: var(--perigo); font-size: 14px; }
    button:disabled { opacity: 0.6; }
  `,
})
export class MemberStats {
  protected readonly social = inject(SocialService);
  protected readonly nav = inject(NavegacaoService);
  private readonly router = inject(Router);

  /** Identificador da pessoa, vindo da rota (`/membro/:uid`). */
  readonly uid = input.required<string>();

  private readonly fim = viewChild<ElementRef<HTMLElement>>('fim');

  protected readonly aba = signal<Aba>('timeline');
  protected readonly enviando = signal(false);
  protected readonly confirmandoRemocao = signal(false);

  protected readonly perfil = computed(() => this.social.perfilDe(this.uid()));
  protected readonly amigo = computed(() => this.social.ehAmigo(this.uid()));
  /** Estado do pedido de amizade com esta pessoa, enquanto ainda não são amigos. */
  protected readonly estadoAmizade = computed(() => {
    const a = this.social.amizadeCom(this.uid());
    if (!a) return 'nenhum';
    return a.de === this.social.eu()?.uid ? 'pedido-enviado' : 'pedido-recebido';
  });
  protected readonly sessoes = computed(() => this.social.sessoesDe(this.uid()));
  protected readonly carregado = computed(() => {
    this.social.sessoesDe(this.uid()); // começa a acompanhar os treinos da pessoa
    return this.social.sessoesCarregadas(this.uid());
  });
  /** Peso que o amigo compartilha; só amigos têm acesso a ele. */
  protected readonly pesos = computed(() => (this.amigo() ? (this.social.pesoDe(this.uid()) ?? null) : null));
  protected readonly itens = computed(() => this.social.timelineVisivelDePessoa(this.uid()));
  protected readonly temMais = computed(() => this.social.temMaisDePessoa(this.uid()));
  protected readonly primeiroNome = computed(() => {
    const nome = this.perfil()?.nome ?? '';
    return nome.trim().split(/\s+/)[0] || nome;
  });

  private readonly medalhasService = inject(MedalhasService);
  /** As medalhas da pessoa, calculadas dos treinos dela (os mais recentes) com a meta semanal dela. */
  protected readonly conquistas = computed(() => ordenarPorNivel(this.medalhasService.conquistasDe(this.sessoes(), this.perfil()?.metaSemanal ?? 3)));
  protected readonly resumoConquistas = computed(() => {
    const degraus = this.conquistas().flatMap((c) => c.degraus);
    return `${degraus.filter((d) => d.conquistado).length} de ${degraus.length} níveis conquistados`;
  });
  protected readonly galeriaAberta = signal(false);
  protected readonly foco = signal<TipoConquista | null>(null);

  protected abrirGaleria(foco: TipoConquista | null): void {
    this.foco.set(foco);
    this.galeriaAberta.set(true);
  }

  constructor() {
    // As estatísticas da própria pessoa têm tela própria.
    effect(() => {
      if (this.social.eu()?.uid === this.uid()) untracked(() => void this.router.navigateByUrl('/estatisticas', { replaceUrl: true }));
    });
    // Traz a meta mais recente da pessoa.
    effect(() => {
      const uid = this.uid();
      if (this.social.ativo() && this.social.podeVer(uid)) untracked(() => void this.social.atualizarPerfil(uid));
    });
    // Rolagem infinita da timeline do amigo.
    effect((onCleanup) => {
      const alvo = this.fim()?.nativeElement;
      void this.itens().length;
      if (!alvo || typeof IntersectionObserver === 'undefined') return;
      const obs = new IntersectionObserver(
        (entradas) => {
          if (entradas.some((e) => e.isIntersecting)) this.social.carregarMaisDePessoa(this.uid());
        },
        { rootMargin: '400px 0px' },
      );
      obs.observe(alvo);
      onCleanup(() => obs.disconnect());
    });
    // A timeline na tela já nasce vista: some o aviso da aba Social.
    effect(() => {
      if (!this.amigo() || this.aba() !== 'timeline') return;
      this.social.timeline();
      untracked(() => this.social.marcarTimelineVista());
    });
  }

  protected async pedirAmizade(): Promise<void> {
    this.enviando.set(true);
    await this.social.pedirAmizade(this.uid());
    this.enviando.set(false);
  }

  protected async cancelarPedido(): Promise<void> {
    const a = this.social.amizadeCom(this.uid());
    if (a) await this.social.removerAmizade(a);
  }

  protected async desfazer(): Promise<void> {
    const a = this.social.amizadeCom(this.uid());
    this.confirmandoRemocao.set(false);
    if (a) await this.social.removerAmizade(a);
  }
}
