import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar } from '../core/avatar';
import { AvatarGrupo } from '../core/avatar-grupo';
import { Dialogo } from '../core/dialogo';
import { larguraDaPessoa } from '../core/faixa-pessoas';
import { FotoBotao } from '../core/foto-botao';
import { Icon } from '../core/icon';
import { NavegacaoService } from '../core/navegacao.service';
import { tempoRelativo } from '../core/social';
import { SocialService } from '../core/social.service';
import { Carregando } from '../core/spinner';
import { EventoCard } from './evento-card';

/** Tela de um grupo: só a timeline de quem está nele. Estatísticas ficam na tela de cada pessoa. */
@Component({
  selector: 'app-group',
  imports: [RouterLink, Avatar, AvatarGrupo, Dialogo, FotoBotao, Icon, EventoCard, Carregando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:resize)': 'medirFaixa()' },
  template: `
    <section class="page">
      <header class="cabeca">
        <button type="button" class="voltar" aria-label="Voltar" (click)="nav.voltar('/social')"><app-icon name="back" [size]="20" [stroke]="2.2" /></button>
        <h1 class="titulo nome">{{ grupo()?.nome ?? 'Grupo' }}</h1>
        @if (grupo(); as g) {
          <button type="button" class="imagem" aria-haspopup="dialog" [attr.aria-label]="souDono() ? 'Alterar a imagem do grupo' : 'Ver a imagem do grupo'" (click)="imagemAberta.set(true)">
            <app-avatar-grupo [nome]="g.nome" [foto]="g.foto" [tamanho]="44" />
          </button>
        }
      </header>

      @if (!social.ativo()) {
        @if (social.erro()) {
          <p class="erro" role="alert">{{ social.erro() }}</p>
        } @else {
          <app-carregando texto="Conectando…" />
        }
      } @else if (!grupo()) {
        @if (social.gruposCarregados()) {
          <div class="card vazio">
            <h2 class="sub">Grupo não encontrado</h2>
            <p class="apoio">Você não faz parte deste grupo (ou ele foi apagado).</p>
            <a class="btn btn--escuro" routerLink="/social">Ver meus grupos</a>
          </div>
        } @else {
          <app-carregando texto="Carregando grupo…" />
        }
      } @else {
        @if (grupo(); as g) {
          <div class="faixa">
            <div class="pessoas" role="list" aria-label="Membros do grupo" #lista (scroll)="medirFaixa()" [style.--item.px]="larguraItem()"
                 [class.mais-direita]="maisDireita()" [class.mais-esquerda]="maisEsquerda()">
              @for (m of membros(); track m.uid) {
                <a role="listitem" [routerLink]="m.uid === social.eu()?.uid ? '/estatisticas' : ['/membro', m.uid]" [attr.aria-label]="'Estatísticas de ' + m.nome">
                  <app-avatar [usuario]="{ uid: m.uid, nome: m.nome, email: '', foto: m.foto }" [tamanho]="36" />
                  <span>{{ m.uid === social.eu()?.uid ? 'Eu' : primeiroNome(m.nome) }}</span>
                </a>
              }
            </div>
            <a class="mais" [routerLink]="['/grupo', g.id, 'convidar']" aria-label="Convidar pessoas">
              <app-icon name="plus" [size]="20" [stroke]="2.4" /><span>Convidar</span>
            </a>
          </div>
        }

        @if (social.erro()) {
          <p class="erro" role="alert">{{ social.erro() }}</p>
        }

        @for (item of itens(); track item.chave) {
          @if (item.tipo === 'evento') {
            <app-evento-card [evento]="item.evento" />
          } @else {
            <div class="card reacao">
              <app-avatar [usuario]="{ uid: item.atividade.autor, nome: social.nomeDe(item.atividade.autor, item.atividade.autorNome), email: '', foto: social.fotoDe(item.atividade.autor, item.atividade.autorFoto) }" [tamanho]="28" />
              <p>
                <strong>{{ social.nomeDe(item.atividade.autor, item.atividade.autorNome) }}</strong>
                @if (item.atividade.tipo === 'curtida') {
                  curtiu o seu treino.
                } @else {
                  comentou no seu treino: “{{ item.atividade.texto }}”
                }
                <span class="apoio quando">{{ quando(item.criadoEm) }}</span>
              </p>
            </div>
          }
        } @empty {
          <div class="card vazio">
            <h2 class="sub">Nada por aqui ainda</h2>
            <p class="apoio">Os treinos concluídos de quem está no grupo aparecem aqui, com curtidas e comentários.</p>
            <a class="btn btn--escuro" [routerLink]="['/grupo', id(), 'convidar']">Convidar pessoas</a>
          </div>
        }
        @if (temMais() && itens().length > 0) {
          <div #fim class="fim-lista" role="status">
            <app-carregando texto="Carregando mais treinos…" />
            <button type="button" class="btn btn--claro" (click)="social.carregarMais(id())">Carregar mais</button>
          </div>
        }
      }

      @if (imagemAberta()) {
        @if (grupo(); as g) {
          <app-dialogo [titulo]="g.nome" subtitulo="Imagem do grupo" (fechar)="imagemAberta.set(false)">
            <div class="imagem-grande">
              <app-avatar-grupo [nome]="g.nome" [foto]="g.foto" [tamanho]="240" />
            </div>
            @if (souDono()) {
              <div class="acoes-coluna">
                <app-foto-botao [perfil]="true" rotulo="Alterar imagem" (escolhida)="trocarImagem($event)" (falhou)="erroImagem.set($event)" />
                @if (g.foto) {
                  <button type="button" class="btn btn--claro" [disabled]="salvandoImagem()" (click)="tirarImagem()">Remover imagem</button>
                }
              </div>
              @if (salvandoImagem()) {
                <p class="apoio" role="status">Salvando a imagem…</p>
              }
              @if (erroImagem()) {
                <p class="apoio erro" role="alert">{{ erroImagem() }}</p>
              }
            } @else {
              <p class="apoio centro">Só o dono do grupo troca a imagem.</p>
            }
          </app-dialogo>
        }
      }
    </section>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: 10px; padding-bottom: 24px; }
    .cabeca { display: flex; align-items: center; gap: 8px; }
    .voltar { flex: none; width: 44px; height: 44px; border: 0; border-radius: 50%; background: var(--soft); color: var(--ink); display: flex; align-items: center; justify-content: center; }
    .imagem { flex: none; padding: 0; border: 0; background: none; display: flex; border-radius: 13px; }
    .nome { flex: 1; min-width: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 26px; }
    .faixa { display: flex; align-items: flex-start; gap: 4px; }
    .pessoas { flex: 1; min-width: 0; display: flex; gap: 4px; overflow-x: auto; padding: 4px 2px 8px; scrollbar-width: none; }
    .pessoas::-webkit-scrollbar { display: none; }
    /* Esmaece a borda onde ainda há pessoas escondidas, para indicar que a lista rola. */
    .pessoas.mais-direita { -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent); mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent); }
    .pessoas.mais-esquerda { -webkit-mask-image: linear-gradient(to left, #000 calc(100% - 28px), transparent); mask-image: linear-gradient(to left, #000 calc(100% - 28px), transparent); }
    .pessoas.mais-direita.mais-esquerda { -webkit-mask-image: linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 28px), transparent); mask-image: linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 28px), transparent); }
    .pessoas a { flex: none; min-width: 46px; width: var(--item, auto); display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; color: var(--muted); text-decoration: none; padding: 4px 2px; border-radius: 14px; }
    .pessoas a span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* Fora da rolagem: o botão de convidar fica sempre à vista, à direita. */
    .mais { flex: none; min-width: 52px; margin-top: 4px; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; color: var(--muted); text-decoration: none; padding: 4px; border-radius: 14px; }
    .mais app-icon { width: 36px; height: 36px; border-radius: 50%; border: 1.5px dashed var(--line); display: flex; align-items: center; justify-content: center; }
    .fim-lista { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 8px 0 16px; min-height: 64px; }
    .fim-lista .btn { min-height: 40px; font-size: 14px; }
    .reacao { padding: 8px 12px; display: flex; align-items: center; gap: 10px; }
    .reacao p { margin: 0; font-size: 13px; line-height: 1.35; overflow-wrap: anywhere; }
    .quando { margin-left: 6px; font-size: 12px; }
    .vazio { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
    .sub { font-size: 18px; margin: 0; }
    .imagem-grande { display: flex; justify-content: center; margin-bottom: 16px; }
    .acoes-coluna { display: flex; flex-direction: column; gap: 10px; }
    .centro { text-align: center; margin: 0; }
    .erro { color: var(--perigo); font-size: 14px; }
    button:disabled { opacity: 0.6; }
  `,
})
export class Group {
  protected readonly social = inject(SocialService);
  protected readonly nav = inject(NavegacaoService);

  /** Código do grupo, vindo da rota (`/grupo/:id`). */
  readonly id = input.required<string>();

  private readonly fim = viewChild<ElementRef<HTMLElement>>('fim');
  private readonly lista = viewChild<ElementRef<HTMLElement>>('lista');

  protected readonly grupo = computed(() => this.social.grupo(this.id()));
  protected readonly souDono = computed(() => !!this.grupo() && this.grupo()?.dono === this.social.eu()?.uid);
  protected readonly membros = computed(() => {
    const g = this.grupo();
    return g ? this.social.membrosDe(g) : [];
  });
  protected readonly itens = computed(() => this.social.timelineVisivelDe(this.id()));
  protected readonly temMais = computed(() => this.social.temMaisDe(this.id()));

  protected readonly imagemAberta = signal(false);
  protected readonly salvandoImagem = signal(false);
  protected readonly erroImagem = signal('');

  protected readonly maisDireita = signal(false);
  protected readonly maisEsquerda = signal(false);
  /** Largura de cada pessoa, ajustada para sempre deixar à mostra um pedaço da próxima; `null` = largura natural. */
  protected readonly larguraItem = signal<number | null>(null);

  /** Atualiza os indicadores de "tem mais gente para os lados" da faixa de membros. */
  protected medirFaixa(): void {
    const el = this.lista()?.nativeElement;
    if (!el) return;
    this.maisEsquerda.set(el.scrollLeft > 4);
    this.maisDireita.set(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    this.larguraItem.set(larguraDaPessoa(el.clientWidth - 4, el.children.length)); // 4 = o respiro interno da faixa
  }

  constructor() {
    // Remede a faixa quando ela aparece ou a lista de membros muda.
    effect(() => {
      this.lista();
      this.membros();
      requestAnimationFrame(() => this.medirFaixa());
    });
    // A faixa muda de largura com a tela (girar o celular, janela): refaz a conta.
    effect((onCleanup) => {
      const el = this.lista()?.nativeElement;
      if (!el || typeof ResizeObserver === 'undefined') return;
      const obs = new ResizeObserver(() => this.medirFaixa());
      obs.observe(el);
      onCleanup(() => obs.disconnect());
    });
    // Rolagem infinita: quando o fim da lista chega perto da tela, entra mais uma página.
    // Observa de novo a cada página (se o fim continuar à vista, pede a seguinte).
    effect((onCleanup) => {
      const alvo = this.fim()?.nativeElement;
      void this.itens().length;
      if (!alvo || typeof IntersectionObserver === 'undefined') return;
      const obs = new IntersectionObserver(
        (entradas) => {
          if (entradas.some((e) => e.isIntersecting)) this.social.carregarMais(this.id());
        },
        { rootMargin: '400px 0px' },
      );
      obs.observe(alvo);
      onCleanup(() => obs.disconnect());
    });
    // Com a timeline na tela, o que chega (agora ou enquanto olha) já nasce visto e o aviso da aba some.
    effect(() => {
      if (!this.social.ativo() || !this.grupo()) return;
      this.social.timeline();
      untracked(() => this.social.marcarTimelineVista());
    });
    // Abrir o grupo (ou alguém entrar com ele aberto) é ver quem está nele: o aviso de gente nova some.
    effect(() => {
      const g = this.grupo();
      if (!this.social.ativo() || !g) return;
      void g.membros.length;
      untracked(() => this.social.marcarMembrosVistos(g.id));
    });
  }

  protected async trocarImagem(dados: string): Promise<void> {
    await this.salvarImagem(dados);
  }

  protected async tirarImagem(): Promise<void> {
    await this.salvarImagem(null);
  }

  private async salvarImagem(dados: string | null): Promise<void> {
    const g = this.grupo();
    if (!g) return;
    this.erroImagem.set('');
    this.salvandoImagem.set(true);
    const ok = await this.social.definirFotoDoGrupo(g, dados);
    this.salvandoImagem.set(false);
    if (!ok) this.erroImagem.set('Não consegui salvar a imagem. Confira a conexão e tente de novo.');
  }

  protected primeiroNome(nome: string): string {
    return nome.trim().split(/\s+/)[0] || nome;
  }

  protected quando(t: number): string {
    return tempoRelativo(t, Date.now());
  }
}
