import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar } from '../core/avatar';
import { CloudService } from '../core/cloud.service';
import { Icon } from '../core/icon';
import { PlanService } from '../core/plan.service';
import { tempoRelativo } from '../core/social';
import { SocialService } from '../core/social.service';
import { Carregando } from '../core/spinner';
import { EventoCard } from './evento-card';
import { Progress } from './progress';

type Aba = 'timeline' | 'estatisticas';

// Guardados fora do componente: ao voltar de outra tela, a aba e a pessoa escolhidas continuam.
const aba = signal<Aba>('timeline');
const pessoaEscolhida = signal<string>('eu');

@Component({
  selector: 'app-social',
  imports: [RouterLink, Avatar, Icon, EventoCard, Progress, Carregando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:resize)': 'medirFaixa()' },
  template: `
    <section class="page">
      <header class="cabeca">
        <div>
          <p class="apoio">Você e seus amigos</p>
          <h1 class="titulo">Social</h1>
        </div>
        <a class="amigos" routerLink="/amigos" aria-label="Amigos">
          <app-icon name="people" [size]="22" [stroke]="2" />
          @if (social.convitesRecebidos().length; as n) {
            <span class="aviso-n">{{ n }}</span>
          }
        </a>
      </header>

      @if (!cloud.configurado) {
        <p class="apoio">A parte social precisa do login. Ela fica disponível quando a conta estiver configurada.</p>
      } @else if (!social.ativo()) {
        @if (social.erro()) {
          <p class="erro" role="alert">{{ social.erro() }}</p>
        } @else {
          <app-carregando texto="Conectando…" />
        }
      } @else {
        <div class="abas-sociais" role="tablist" aria-label="Seção">
          <button type="button" role="tab" [attr.aria-selected]="aba() === 'timeline'" (click)="aba.set('timeline')">Timeline</button>
          <button type="button" role="tab" [attr.aria-selected]="aba() === 'estatisticas'" (click)="aba.set('estatisticas')">Estatísticas</button>
        </div>

        @if (social.erro()) {
          <p class="erro" role="alert">{{ social.erro() }}</p>
        }

        @if (aba() === 'timeline') {
          @for (item of social.timeline(); track item.chave) {
            @if (item.tipo === 'evento') {
              <app-evento-card [evento]="item.evento" />
            } @else {
              <div class="card reacao">
                <app-avatar [usuario]="{ uid: item.atividade.autor, nome: social.nomeDe(item.atividade.autor, item.atividade.autorNome), email: '', foto: social.fotoDe(item.atividade.autor, item.atividade.autorFoto) }" [tamanho]="36" />
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
              <p class="apoio">Seus treinos concluídos e os dos seus amigos aparecem aqui, com curtidas e comentários.</p>
              <a class="btn btn--escuro" routerLink="/amigos">Adicionar amigos</a>
            </div>
          }
        } @else {
          <div class="faixa">
            <div class="pessoas" role="radiogroup" aria-label="Ver estatísticas de" #lista (scroll)="medirFaixa()"
                 [class.mais-direita]="maisDireita()" [class.mais-esquerda]="maisEsquerda()">
              <button type="button" role="radio" [attr.aria-checked]="pessoa() === 'eu'" (click)="pessoaEscolhida.set('eu')">
                @if (cloud.usuario(); as u) {
                  <app-avatar [usuario]="u" [tamanho]="40" />
                }
                <span>Eu</span>
              </button>
              @for (p of social.amigos(); track p.perfil.uid) {
                <button type="button" role="radio" [attr.aria-checked]="pessoa() === p.perfil.uid" (click)="escolher(p.perfil.uid)">
                  <app-avatar [usuario]="{ uid: p.perfil.uid, nome: p.perfil.nome, email: '', foto: p.perfil.foto }" [tamanho]="40" />
                  <span>{{ primeiroNome(p.perfil.nome) }}</span>
                </button>
              }
            </div>
            <a class="mais" routerLink="/amigos" aria-label="Adicionar amigos"><app-icon name="plus" [size]="20" [stroke]="2.4" /><span>Amigo</span></a>
          </div>

          @for (k of [pessoa()]; track k) {
            @if (k === 'eu') {
              <app-progress [historico]="plans.historico()" />
            } @else if (amigoAtual(); as a) {
              @if (carregado()) {
                <p class="apoio">Estatísticas de {{ a.nome }}, compartilhadas com os amigos.</p>
                <app-progress [historico]="sessoesAmigo()" [editavel]="false" [nome]="primeiroNome(a.nome)" [metaBase]="a.metaSemanal" />
              } @else {
                <app-carregando texto="Carregando treinos…" />
              }
            }
          }
        }
      }
    </section>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: 16px; }
    .cabeca { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .amigos { position: relative; width: 44px; height: 44px; border-radius: 50%; background: var(--soft); color: var(--ink); display: flex; align-items: center; justify-content: center; flex: none; }
    .aviso-n { position: absolute; top: -4px; right: -4px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px; background: var(--ink); color: var(--accent); font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .abas-sociais { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: 14px; background: var(--soft); }
    .abas-sociais button { min-height: 44px; border: 0; border-radius: 10px; background: transparent; font: inherit; font-weight: 600; color: var(--muted); }
    .abas-sociais button[aria-selected='true'] { background: var(--card); color: var(--ink); box-shadow: 0 1px 3px rgba(20, 23, 26, 0.12); }
    .faixa { display: flex; align-items: flex-start; gap: 4px; }
    .pessoas { flex: 1; min-width: 0; display: flex; gap: 12px; overflow-x: auto; padding: 4px 2px 8px; scrollbar-width: none; }
    .pessoas::-webkit-scrollbar { display: none; }
    /* Esmaece a borda onde ainda há pessoas escondidas, para indicar que a lista rola. */
    .pessoas.mais-direita { -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 36px), transparent); mask-image: linear-gradient(to right, #000 calc(100% - 36px), transparent); }
    .pessoas.mais-esquerda { -webkit-mask-image: linear-gradient(to left, #000 calc(100% - 36px), transparent); mask-image: linear-gradient(to left, #000 calc(100% - 36px), transparent); }
    .pessoas.mais-direita.mais-esquerda { -webkit-mask-image: linear-gradient(to right, transparent, #000 36px, #000 calc(100% - 36px), transparent); mask-image: linear-gradient(to right, transparent, #000 36px, #000 calc(100% - 36px), transparent); }
    .pessoas button { flex: none; min-width: 60px; display: flex; flex-direction: column; align-items: center; gap: 4px; border: 0; background: none; font: inherit; font-size: 12px; color: var(--muted); padding: 4px; border-radius: 14px; }
    .pessoas button[aria-checked='true'] { color: var(--ink); font-weight: 700; }
    .pessoas button[aria-checked='true'] app-avatar { box-shadow: 0 0 0 2px var(--card), 0 0 0 4px var(--ink); }
    /* Fora da rolagem: o botão de adicionar amigo fica sempre à vista. */
    .mais { flex: none; min-width: 60px; margin-top: 4px; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 12px; color: var(--muted); padding: 4px; border-radius: 14px; }
    .mais app-icon { width: 40px; height: 40px; border-radius: 50%; border: 1.5px dashed var(--line); display: flex; align-items: center; justify-content: center; }
    .reacao { padding: 12px 16px; display: flex; align-items: center; gap: 12px; }
    .reacao p { margin: 0; font-size: 14px; line-height: 1.4; overflow-wrap: anywhere; }
    .quando { margin-left: 6px; font-size: 12px; }
    .vazio { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
    .sub { font-size: 18px; margin: 0; }
    .erro { color: #b3261e; font-size: 14px; }
  `,
})
export class Social {
  protected readonly cloud = inject(CloudService);
  protected readonly social = inject(SocialService);
  protected readonly plans = inject(PlanService);
  protected readonly aba = aba;
  protected readonly pessoaEscolhida = pessoaEscolhida;

  private readonly lista = viewChild<ElementRef<HTMLElement>>('lista');
  protected readonly maisDireita = signal(false);
  protected readonly maisEsquerda = signal(false);

  /** Atualiza os indicadores de "tem mais gente para os lados" da faixa de pessoas. */
  protected medirFaixa(): void {
    const el = this.lista()?.nativeElement;
    if (!el) return;
    this.maisEsquerda.set(el.scrollLeft > 4);
    this.maisDireita.set(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  constructor() {
    // Remede a faixa quando ela aparece ou a lista de amigos muda.
    effect(() => {
      this.lista();
      this.social.amigos();
      requestAnimationFrame(() => this.medirFaixa());
    });
    // Com a timeline na tela, o que chega (agora ou enquanto olha) já nasce visto e o aviso da aba some.
    effect(() => {
      if (aba() !== 'timeline' || !this.social.ativo()) return;
      this.social.timeline();
      untracked(() => this.social.marcarTimelineVista());
    });
  }

  /** Se o amigo escolhido deixou de ser amigo, volta para "Eu". */
  protected readonly pessoa = computed(() => {
    const p = pessoaEscolhida();
    return p === 'eu' || this.social.amigos().some((a) => a.perfil.uid === p) ? p : 'eu';
  });
  protected readonly amigoAtual = computed(() => this.social.amigos().find((a) => a.perfil.uid === this.pessoa())?.perfil);

  /** Treinos do amigo escolhido (a leitura começa ao escolher). */
  protected readonly sessoesAmigo = computed(() => (this.pessoa() === 'eu' ? [] : this.social.sessoesDe(this.pessoa())));
  protected readonly carregado = computed(() => {
    const p = this.pessoa();
    if (p === 'eu') return false;
    this.social.sessoesDe(p); // começa a acompanhar os treinos do amigo
    return this.social.sessoesCarregadas(p);
  });

  protected escolher(uid: string): void {
    pessoaEscolhida.set(uid);
    void this.social.atualizarPerfil(uid); // traz a meta mais recente do amigo
  }

  protected primeiroNome(nome: string): string {
    return nome.trim().split(/\s+/)[0] || nome;
  }

  protected quando(t: number): string {
    return tempoRelativo(t, Date.now());
  }
}
