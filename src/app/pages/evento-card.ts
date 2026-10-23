import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { Avatar } from '../core/avatar';
import { Dialogo } from '../core/dialogo';
import { Icon } from '../core/icon';
import { PlanService } from '../core/plan.service';
import { SessaoDetalhe } from '../core/sessao-detalhe';
import { Comentario, Evento, TAMANHO_COMENTARIO, tempoRelativo } from '../core/social';
import { SocialService } from '../core/social.service';

/** Treino de alguém na timeline, com curtidas e comentários. */
@Component({
  selector: 'app-evento-card',
  imports: [Avatar, Icon, SessaoDetalhe, Dialogo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card">
      <header class="topo">
        <app-avatar [usuario]="{ uid: evento().autor, nome: social.nomeDe(evento().autor, evento().autorNome), email: '', foto: social.fotoDe(evento().autor, evento().autorFoto) }" [tamanho]="32" />
        <div class="quem">
          <p class="linha-nome"><strong>{{ minha() ? 'Você' : social.nomeDe(evento().autor, evento().autorNome) }}</strong> <span class="apoio">· {{ quando() }}</span></p>
          <p class="ficha">{{ evento().fichaNome }}</p>
        </div>
      </header>

      <div class="corpo">
        <p class="apoio resumo">{{ resumo() }}</p>
        @if (evento().marco || evento().recordes.length) {
          <div class="selos">
            @if (evento().marco) {
              <span class="selo selo--marco">{{ evento().marco }}</span>
            }
            @for (r of evento().recordes; track r.nome) {
              <span class="selo">Recorde: {{ r.nome }} · {{ r.carga }} kg</span>
            }
          </div>
        }
      </div>

      <div class="acoes">
        <button type="button" class="acao" [class.ativa]="curtido()" [attr.aria-pressed]="curtido()" (click)="curtir()">
          <app-icon name="heart" [size]="20" [stroke]="2" /> {{ curtidas().length || '' }}
          <span class="sr-only">{{ curtido() ? 'Descurtir' : 'Curtir' }}</span>
        </button>
        <button type="button" class="acao" [attr.aria-expanded]="aberto()" (click)="aberto.set(!aberto())">
          <app-icon name="comment" [size]="20" [stroke]="2" /> {{ comentarios().length || '' }}
          <span class="sr-only">Comentários</span>
        </button>
        <button type="button" class="acao acao--texto" aria-haspopup="dialog" (click)="abrirDetalhe()">Ver treino</button>
      </div>

      @if (aberto()) {
        <div class="comentarios">
          @for (c of comentarios(); track c.id) {
            <div class="comentario">
              <app-avatar [usuario]="{ uid: c.autor, nome: social.nomeDe(c.autor, c.autorNome), email: '', foto: social.fotoDe(c.autor, c.autorFoto) }" [tamanho]="24" />
              <p>
                <strong>{{ c.autor === social.eu()?.uid ? 'Você' : social.nomeDe(c.autor, c.autorNome) }}</strong> {{ c.texto }}
              </p>
              @if (c.autor === social.eu()?.uid || minha()) {
                <button type="button" class="apagar" aria-label="Apagar comentário" aria-haspopup="dialog" (click)="apagando.set(c)">
                  <app-icon name="close" [size]="14" [stroke]="2.4" />
                </button>
              }
            </div>
          } @empty {
            <p class="apoio">Seja o primeiro a comentar.</p>
          }
          <form class="novo" (submit)="enviar($event, campo)">
            <input #campo type="text" [attr.maxlength]="limite" placeholder="Escreva um comentário" aria-label="Comentário" />
            <button type="submit" class="btn btn--escuro">Enviar</button>
          </form>
        </div>
      }
    </article>

    @if (apagando(); as c) {
      <app-dialogo titulo="Apagar comentário?" [subtitulo]="c.autor === social.eu()?.uid ? 'Seu comentário' : 'Comentário de ' + social.nomeDe(c.autor, c.autorNome)" (fechar)="apagando.set(null)">
        <blockquote class="previa">{{ c.texto }}</blockquote>
        <p class="apoio">Essa ação não pode ser desfeita.</p>
        <div class="confirma">
          <button type="button" class="btn btn--apagar" (click)="confirmarApagar(c)">Apagar</button>
          <button type="button" class="btn btn--claro" (click)="apagando.set(null)">Cancelar</button>
        </div>
      </app-dialogo>
    }

    @if (detalhe()) {
      <app-dialogo [titulo]="evento().fichaNome" [subtitulo]="subtituloDetalhe()" (fechar)="detalhe.set(false)">
        @if (sessao(); as s) {
          <app-sessao-detalhe [sessao]="s" />
        } @else if (carregandoSessao()) {
          <p class="apoio">Carregando o treino…</p>
        } @else {
          <p class="apoio">Não encontrei os detalhes deste treino.</p>
        }
      </app-dialogo>
    }
  `,
  styles: `
    .card { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .topo { display: flex; align-items: center; gap: 10px; }
    .quem { display: flex; flex-direction: column; min-width: 0; }
    .quem p { margin: 0; }
    .linha-nome { font-size: 13px; line-height: 1.3; }
    .linha-nome .apoio { font-size: 12px; margin-left: 2px; }
    .ficha { font-family: var(--font-display); font-size: 17px; font-weight: 700; line-height: 1.2; overflow-wrap: anywhere; }
    .corpo { display: flex; flex-direction: column; gap: 6px; }
    .corpo p { margin: 0; }
    .resumo { font-size: 13px; }
    .selos { display: flex; flex-wrap: wrap; gap: 4px 6px; }
    .selo { padding: 2px 8px; border-radius: 999px; background: #f1f8cf; font-size: 12px; line-height: 1.5; }
    .selo--marco { background: var(--ink); color: var(--accent); font-weight: 700; }
    .acoes { display: flex; gap: 6px; }
    .acao { min-height: 40px; min-width: 48px; padding: 0 12px; border: 1px solid var(--line); border-radius: 20px; background: var(--card); color: var(--ink); font: inherit; font-size: 14px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; }
    .previa { margin: 0 0 8px; padding: 10px 12px; border-left: 3px solid var(--line); background: var(--soft); border-radius: 0 10px 10px 0; font-size: 15px; line-height: 1.4; overflow-wrap: anywhere; }
    .confirma { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
    .btn--apagar { background: #b3261e; color: #fff; }
    .acao--texto { margin-left: auto; font-weight: 600; font-size: 13px; }
    .acao.ativa { background: var(--ink); color: var(--accent); border-color: var(--ink); }
    .comentarios { border-top: 1px solid var(--soft); padding-top: 8px; display: flex; flex-direction: column; gap: 8px; }
    .comentario { display: flex; align-items: flex-start; gap: 8px; }
    .comentario p { margin: 0; flex: 1; font-size: 13px; line-height: 1.35; overflow-wrap: anywhere; }
    .apagar { width: 32px; height: 32px; border: 0; background: none; color: var(--muted); display: flex; align-items: center; justify-content: center; }
    .novo { display: flex; gap: 8px; }
    .novo input { flex: 1; min-width: 0; min-height: 40px; padding: 0 12px; border-radius: 12px; border: 1px solid var(--line); font: inherit; background: var(--card); }
    .novo .btn { min-height: 40px; padding: 0 14px; font-size: 14px; }
  `,
})
export class EventoCard {
  readonly evento = input.required<Evento>();
  protected readonly social = inject(SocialService);
  private readonly plans = inject(PlanService);
  protected readonly limite = TAMANHO_COMENTARIO;
  protected readonly curtidas = signal<string[]>([]);
  protected readonly comentarios = signal<Comentario[]>([]);
  protected readonly aberto = signal(false);
  protected readonly detalhe = signal(false);
  /** Comentário esperando a confirmação para ser apagado. */
  protected readonly apagando = signal<Comentario | null>(null);

  /** O treino completo: o seu vem do histórico do aparelho; o de um amigo, dos treinos que ele compartilha. */
  protected readonly sessao = computed(() => {
    if (!this.detalhe()) return undefined;
    const e = this.evento();
    const lista = this.minha() ? this.plans.historico() : this.social.sessoesDe(e.autor);
    return lista.find((s) => s.id === e.sessaoId);
  });
  protected readonly carregandoSessao = computed(() => this.detalhe() && !this.minha() && !this.social.sessoesCarregadas(this.evento().autor));

  protected readonly minha = computed(() => this.evento().autor === this.social.eu()?.uid);
  protected readonly curtido = computed(() => this.curtidas().includes(this.social.eu()?.uid ?? ''));
  protected readonly quando = computed(() => tempoRelativo(this.evento().criadoEm, Date.now()));
  protected readonly resumo = computed(() => {
    const e = this.evento();
    const partes = [e.exercicios ? `${e.exercicios} ${e.exercicios === 1 ? 'exercício' : 'exercícios'}` : '', e.volume ? `${e.volume >= 1000 ? (e.volume / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' t' : e.volume + ' kg'} de carga` : ''];
    return partes.filter(Boolean).join(' · ') || 'Treino concluído';
  });

  constructor() {
    const destruir = inject(DestroyRef);
    let parar: (() => void)[] = [];
    effect(() => {
      const e = this.evento();
      this.social.eu(); // as reações só podem ser lidas depois que o perfil está pronto
      parar.forEach((p) => p());
      parar = [
        this.social.ouvirCurtidas(e.autor, e.id, (l) => this.curtidas.set(l)),
        this.social.ouvirComentarios(e.autor, e.id, (l) => this.comentarios.set(l)),
      ];
    });
    destruir.onDestroy(() => parar.forEach((p) => p()));
  }

  /** "Você · quinta-feira, 22 de outubro". */
  protected readonly subtituloDetalhe = computed(() => {
    const e = this.evento();
    const [a, m, d] = e.data.split('-').map(Number);
    const dia = new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const quem = this.minha() ? 'Você' : this.social.nomeDe(e.autor, e.autorNome);
    return `${quem} · ${dia.charAt(0).toUpperCase()}${dia.slice(1)}`;
  });

  protected abrirDetalhe(): void {
    if (!this.minha()) this.social.sessoesDe(this.evento().autor); // começa a ler os treinos do amigo
    this.detalhe.set(true);
  }

  protected curtir(): void {
    const e = this.evento();
    void this.social.alternarCurtida(e.autor, e.id, this.curtido());
  }

  protected enviar(ev: Event, campo: HTMLInputElement): void {
    ev.preventDefault();
    const texto = campo.value.trim();
    if (!texto) return;
    const e = this.evento();
    campo.value = '';
    void this.social.comentar(e.autor, e.id, texto);
  }

  protected confirmarApagar(c: Comentario): void {
    const e = this.evento();
    this.apagando.set(null);
    void this.social.apagarComentario(e.autor, e.id, c);
  }
}
