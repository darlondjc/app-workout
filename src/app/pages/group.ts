import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar } from '../core/avatar';
import { Icon } from '../core/icon';
import { NavegacaoService } from '../core/navegacao.service';
import { tempoRelativo } from '../core/social';
import { SocialService } from '../core/social.service';
import { Carregando } from '../core/spinner';
import { EventoCard } from './evento-card';

/** Tela de um grupo: só a timeline de quem está nele. Estatísticas ficam na tela de cada pessoa. */
@Component({
  selector: 'app-group',
  imports: [RouterLink, Avatar, Icon, EventoCard, Carregando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="cabeca">
        <button type="button" class="voltar" aria-label="Voltar" (click)="nav.voltar('/social')"><app-icon name="back" [size]="20" [stroke]="2.2" /></button>
        <h1 class="titulo nome">{{ grupo()?.nome ?? 'Grupo' }}</h1>
        @if (grupo()) {
          <a class="convidar" [routerLink]="['/grupo', id(), 'convidar']" aria-label="Convidar pessoas"><app-icon name="user-add" [size]="22" [stroke]="2" /></a>
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
          <div class="pessoas" role="list" aria-label="Membros do grupo">
            @for (m of membros(); track m.uid) {
              <a role="listitem" [routerLink]="m.uid === social.eu()?.uid ? '/estatisticas' : ['/membro', m.uid]" [attr.aria-label]="'Estatísticas de ' + m.nome">
                <app-avatar [usuario]="{ uid: m.uid, nome: m.nome, email: '', foto: m.foto }" [tamanho]="40" />
                <span>{{ m.uid === social.eu()?.uid ? 'Eu' : primeiroNome(m.nome) }}</span>
              </a>
            }
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
    </section>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: 10px; padding-bottom: 24px; }
    .cabeca { display: flex; align-items: center; gap: 8px; }
    .voltar, .convidar { flex: none; width: 44px; height: 44px; border: 0; border-radius: 50%; background: var(--soft); color: var(--ink); display: flex; align-items: center; justify-content: center; }
    .nome { flex: 1; min-width: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 26px; }
    .pessoas { display: flex; gap: 6px; overflow-x: auto; padding: 4px 2px 8px; scrollbar-width: none; }
    .pessoas::-webkit-scrollbar { display: none; }
    .pessoas a { flex: none; min-width: 52px; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; color: var(--muted); text-decoration: none; padding: 4px 2px; max-width: 64px; }
    .pessoas a span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pessoas .mais app-icon { width: 40px; height: 40px; border-radius: 50%; border: 1.5px dashed var(--line); display: flex; align-items: center; justify-content: center; }
    .fim-lista { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 8px 0 16px; min-height: 64px; }
    .fim-lista .btn { min-height: 40px; font-size: 14px; }
    .reacao { padding: 8px 12px; display: flex; align-items: center; gap: 10px; }
    .reacao p { margin: 0; font-size: 13px; line-height: 1.35; overflow-wrap: anywhere; }
    .quando { margin-left: 6px; font-size: 12px; }
    .vazio { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
    .sub { font-size: 18px; margin: 0; }
    .erro { color: #b3261e; font-size: 14px; }
  `,
})
export class Group {
  protected readonly social = inject(SocialService);
  protected readonly nav = inject(NavegacaoService);

  /** Código do grupo, vindo da rota (`/grupo/:id`). */
  readonly id = input.required<string>();

  private readonly fim = viewChild<ElementRef<HTMLElement>>('fim');

  protected readonly grupo = computed(() => this.social.grupo(this.id()));
  protected readonly membros = computed(() => {
    const g = this.grupo();
    return g ? this.social.membrosDe(g) : [];
  });
  protected readonly itens = computed(() => this.social.timelineVisivelDe(this.id()));
  protected readonly temMais = computed(() => this.social.temMaisDe(this.id()));

  constructor() {
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
  }

  protected primeiroNome(nome: string): string {
    return nome.trim().split(/\s+/)[0] || nome;
  }

  protected quando(t: number): string {
    return tempoRelativo(t, Date.now());
  }
}
