import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar } from '../core/avatar';
import { CloudService } from '../core/cloud.service';
import { Dialogo } from '../core/dialogo';
import { ExercicioDialogo } from '../core/exercicio-dialogo';
import { ExerciseService } from '../core/exercise.service';
import { Icon } from '../core/icon';
import { MedalhasGaleria } from '../core/medalhas-galeria';
import { NOMES_NIVEL, TipoConquista, calcularConquistas, formatarProgresso, historicoDeRecordes, ordenarPorNivel, proximaConquista, regiaoDoExercicio } from '../core/medalhas';
import { QuadroMedalhas } from '../core/quadro-medalhas';
import { lerMeta, metaPadrao } from '../core/meta';
import { SessaoDetalhe } from '../core/sessao-detalhe';
import { SocialService } from '../core/social.service';
import { PlanService, dataLocal } from '../core/plan.service';
import { recordesDaSessao, treinosNaSemana, volumeSessao } from '../core/stats';

const LETRAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const DIAS = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];

/** Quanto a tela precisa rolar para a barra do topo começar a aparecer e até ficar inteira. */
const ROLAGEM_INICIO = 62;
const ROLAGEM_DISTANCIA = 46;

@Component({
  selector: 'app-home',
  imports: [RouterLink, Icon, Avatar, Dialogo, ExercicioDialogo, SessaoDetalhe, MedalhasGaleria, QuadroMedalhas],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      @if (nuvem.usuario(); as u) {
        <!-- Barra que aparece aos poucos conforme a tela rola (o grau vem de --p, definido pelo scroll). Não ocupa espaço na página. -->
        <div class="barra-fixa" aria-hidden="true">
          <div class="barra">
            <span class="barra__nome">{{ primeiroNome() || 'Início' }}</span>
            <a class="barra__conta" routerLink="/ajustes" tabindex="-1">
              <app-avatar [usuario]="social.meuUsuario() ?? u" [tamanho]="34" />
            </a>
          </div>
        </div>
      }
      <header class="cabeca">
        <div>
          <p class="apoio">{{ dataTexto }}</p>
          <h1 class="titulo">{{ titulo() }}</h1>
        </div>
        @if (nuvem.usuario(); as u) {
          <a class="conta" routerLink="/ajustes" aria-label="Minha conta">
            <app-avatar [usuario]="social.meuUsuario() ?? u" [tamanho]="44" />
          </a>
        }
      </header>

      <ol class="semana" aria-label="Semana de treinos">
        @for (d of semana(); track d.data) {
          <li>
            <span class="apoio" aria-hidden="true">{{ d.letra }}</span>
            <span class="dia" [class.feito]="d.feito" [class.hoje]="d.hoje" aria-hidden="true">
              @if (d.feito) {
                <app-icon name="check" [size]="16" [stroke]="3" />
              }
            </span>
            <span class="sr-only">{{ d.descricao }}</span>
          </li>
        }
      </ol>

      @if (concluidoHoje() && resumoHoje(); as r) {
        <article class="destaque" aria-labelledby="t-feito">
          <div class="destaque__topo">
            <div>
              <p class="destaque__rotulo" id="t-feito">Treino de hoje concluído</p>
              <h2 class="destaque__nome">{{ r.nome }}</h2>
            </div>
            <span class="selo selo--feito"><app-icon name="check" [size]="14" [stroke]="3" /> Feito</span>
          </div>
          <ul class="numeros" aria-label="Resumo do treino">
            <li><strong>{{ r.exercicios }}</strong><span>{{ r.exercicios === 1 ? 'exercício' : 'exercícios' }}</span></li>
            <li><strong>{{ r.series }}</strong><span>{{ r.series === 1 ? 'série' : 'séries' }}</span></li>
            @if (r.volume > 0) {
              <li><strong>{{ carga(r.volume) }}</strong><span>de carga</span></li>
            }
          </ul>
          @if (r.textoRecordes) {
            <p class="recorde"><app-icon name="medal" [size]="18" [stroke]="2.2" /> {{ r.textoRecordes }}</p>
          }
          @if (r.sessao.registros?.length) {
            <button type="button" class="btn btn--claro" aria-haspopup="dialog" (click)="sessaoAberta.set(true)">Ver detalhes do treino</button>
          }
        </article>

        @if (plans.proxima(); as prox) {
          <a class="card linha" [routerLink]="['/ficha', prox.id]">
            <span class="letra">{{ plans.letra(prox.id) }}</span>
            <span class="linha__texto">
              <span class="apoio">Próximo treino</span>
              <span class="linha__nome">{{ prox.nome }}</span>
              <span class="apoio">{{ plans.rotulo(prox.id) }} · {{ prox.itens.length }} {{ prox.itens.length === 1 ? 'exercício' : 'exercícios' }}</span>
            </span>
            <app-icon name="chevron" [size]="18" />
          </a>
        }
      } @else if (plans.proxima(); as ficha) {
        <article class="destaque">
          <div class="destaque__topo">
            <div>
              <p class="destaque__rotulo">Treino de hoje · {{ plans.rotulo(ficha.id) }}</p>
              <h2 class="destaque__nome">{{ ficha.nome }}</h2>
            </div>
            <span class="selo">{{ ficha.itens.length }} {{ ficha.itens.length === 1 ? 'exercício' : 'exercícios' }}</span>
          </div>
          @if (grupos(ficha.itens); as gs) {
            @if (gs.length > 0) {
              <ul class="grupos grupos--escuro" aria-label="Grupos musculares do treino">
                @for (g of gs; track g) {
                  <li class="grupo">{{ g }}</li>
                }
              </ul>
            }
          }
          <div class="miniaturas">
            @for (item of ficha.itens.slice(0, 3); track item.exerciseId) {
              <img [src]="exercicios.imagem(item.exerciseId, 0)" alt="" loading="lazy" />
            }
            @if (ficha.itens.length > 3) {
              <span class="mais">+{{ ficha.itens.length - 3 }}</span>
            }
          </div>
          <a class="btn btn--destaque" [routerLink]="['/treino', ficha.id]">
            <app-icon name="play" [size]="18" /> {{ plans.emAndamento()?.fichaId === ficha.id ? 'Continuar treino' : 'Iniciar treino' }}
          </a>
        </article>
      } @else {
        <article class="destaque">
          <h2 class="destaque__nome">Monte sua primeira ficha</h2>
          <p class="destaque__rotulo">Escolha exercícios na biblioteca e defina séries, repetições e carga.</p>
          <a class="btn btn--destaque" routerLink="/biblioteca">
            <app-icon name="plus" [size]="18" [stroke]="2.5" /> Escolher exercícios
          </a>
          <a class="btn btn--claro" routerLink="/fichas/sugestao">Sugerir ficha</a>
        </article>
      }

      @if (!plans.treinouHoje()) {
        <a class="btn btn--claro" routerLink="/treino-do-dia">
          <app-icon name="clipboard" [size]="18" [stroke]="2.2" /> Treino customizado para hoje
        </a>
      }

      @if (plans.fichas().length > 0 || plans.historico().length > 0) {
        <article class="card bloco" aria-labelledby="t-meta-home">
          <div class="bloco__topo">
            <h2 id="t-meta-home" class="rot">Meta da semana</h2>
            <span class="apoio">{{ meta() }}× por semana</span>
          </div>
          <p class="grande">{{ treinosSemana() }} <small>de {{ meta() }} treinos</small></p>
          <div class="trilha" role="progressbar" aria-label="Treinos da semana" aria-valuemin="0" [attr.aria-valuemax]="meta()" [attr.aria-valuenow]="treinosSemana()">
            <div class="trilha__cheia" [style.width.%]="percentualMeta()"></div>
          </div>
          <p class="apoio">{{ textoMeta() }}</p>
        </article>

        <section class="lista" aria-labelledby="titulo-conquistas">
          <div class="lista__topo">
            <h2 id="titulo-conquistas">Medalhas</h2>
            <button type="button" class="ver-todas" aria-haspopup="dialog" (click)="galeriaAberta.set(true)">Ver todas</button>
          </div>
          <app-quadro-medalhas [conquistas]="conquistas()" [hoje]="hojeISO" (abrir)="galeriaAberta.set(true)" />
          @if (proxima(); as p) {
            @if (p.proximo; as alvo) {
              <p class="apoio proxima">Próxima: <strong>{{ nomes[alvo.nivel] }}</strong> em {{ p.titulo }} · {{ progresso(p.id, p.atual, alvo.alvo) }}</p>
            }
          }
        </section>
      }

      @if (plans.fichas().length > 0) {
        <section class="lista" aria-labelledby="titulo-fichas">
          <div class="lista__topo">
            <h2 id="titulo-fichas">Minhas fichas</h2>
            <a routerLink="/fichas" class="ver-todas">Ver todas</a>
          </div>
          @for (f of plans.fichas().slice(0, 3); track f.id) {
            <a class="card linha" [routerLink]="['/ficha', f.id]">
              <span class="letra">{{ plans.letra(f.id) }}</span>
              <span class="linha__texto">
                <span class="linha__nome">{{ f.nome }}</span>
                <span class="apoio">{{ f.itens.length }} {{ f.itens.length === 1 ? 'exercício' : 'exercícios' }}@if (f.conjunto) { · {{ f.conjunto.nome }} }</span>
                @if (grupos(f.itens); as gs) {
                  @if (gs.length > 0) {
                    <ul class="grupos" aria-label="Grupos musculares">
                      @for (g of gs; track g) {
                        <li class="grupo">{{ g }}</li>
                      }
                    </ul>
                  }
                }
              </span>
              <app-icon name="chevron" [size]="18" />
            </a>
          }
        </section>
      }

      @if (galeriaAberta()) {
        <app-dialogo titulo="Medalhas" [subtitulo]="resumoConquistas()" (fechar)="galeriaAberta.set(false)">
          <app-medalhas-galeria [conquistas]="conquistas()" [recordes]="recordesRecentes()" />
        </app-dialogo>
      }

      @if (sessaoAberta() && resumoHoje(); as r) {
        <app-dialogo [titulo]="r.nome" subtitulo="Treino de hoje" (fechar)="sessaoAberta.set(false); exercicioAberto.set(null)">
          <app-sessao-detalhe [sessao]="r.sessao" (verExercicio)="exercicioAberto.set($event)" />
        </app-dialogo>
      }

      @if (exercicioAberto(); as id) {
        <app-exercicio-dialogo [id]="id" (fechar)="exercicioAberto.set(null)" />
      }
    </section>
  `,
  styles: `
    .cabeca {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    /*
     * Barra do topo: um ponto fixo de altura zero (sticky), com a barra solta dentro. Aparece com
     * opacidade e um leve deslize ligados ao quanto a tela rolou (--p, de 0 a 1), só com transform e opacity.
     */
    .barra-fixa {
      position: sticky;
      top: env(safe-area-inset-top, 0px);
      z-index: 5;
      height: 0;
      margin-bottom: -16px;
      --mov: 1;
    }
    .barra {
      position: absolute;
      top: 0;
      left: -20px;
      right: -20px;
      height: 56px;
      padding: 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      isolation: isolate;
      pointer-events: none;
    }
    /* O fundo fosco aparece primeiro (e rápido), para cobrir o que passa por baixo antes do nome entrar. */
    .barra::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      background: color-mix(in srgb, var(--bg) 94%, transparent);
      -webkit-backdrop-filter: saturate(1.4) blur(14px);
      backdrop-filter: saturate(1.4) blur(14px);
      box-shadow: 0 1px 0 color-mix(in srgb, var(--line) 70%, transparent);
      opacity: calc(var(--p, 0) * 3);
      will-change: opacity;
    }
    :host([data-rolado]) .barra {
      pointer-events: auto;
    }
    .barra__nome {
      min-width: 0;
      font-family: var(--font-display);
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      opacity: calc((var(--p, 0) - 0.3) / 0.7);
      transform: translate3d(0, calc((1 - var(--p, 0)) * 8px * var(--mov)), 0);
      will-change: opacity, transform;
    }
    .barra__conta {
      flex: none;
      display: flex;
      border-radius: 50%;
      box-shadow: 0 0 0 2px var(--card), 0 0 0 3px var(--soft);
      opacity: calc((var(--p, 0) - 0.3) / 0.7);
      transform: scale(calc(0.8 + var(--p, 0) * 0.2));
      will-change: opacity, transform;
    }
    @media (prefers-reduced-motion: reduce) {
      .barra-fixa {
        --mov: 0;
      }
    }
    .conta {
      flex: none;
      display: flex;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      box-shadow: 0 0 0 2px var(--card), 0 0 0 3px var(--soft);
    }
    .semana {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .semana li {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .dia {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1.5px solid var(--line);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .dia.hoje {
      border-color: var(--ink);
      border-width: 2px;
    }
    .dia.feito {
      background: var(--ink);
      border-color: var(--ink);
      color: var(--accent);
    }
    .destaque {
      background: var(--ink);
      color: #fff;
      border-radius: 24px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .destaque__topo {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .destaque__rotulo {
      font-size: 13px;
      font-weight: 500;
      color: #b9c0ba;
    }
    .destaque__nome {
      font-family: var(--font-display);
      font-size: 26px;
      line-height: 1.1;
      margin-top: 4px;
    }
    .selo {
      flex: none;
      background: var(--accent);
      color: var(--ink);
      font-size: 12px;
      font-weight: 700;
      border-radius: 999px;
      padding: 6px 10px;
    }
    .selo--feito {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .numeros {
      display: flex;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .numeros li {
      flex: 1;
      min-width: 0;
      background: var(--dark2);
      border-radius: 12px;
      padding: 10px 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      text-align: center;
    }
    .numeros strong {
      font-family: var(--font-display);
      font-size: 22px;
      line-height: 1.1;
    }
    .numeros span {
      font-size: 12px;
      color: #b9c0ba;
    }
    .recorde {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 14px;
      line-height: 1.35;
      color: var(--accent);
    }
    .miniaturas {
      display: flex;
      gap: 8px;
    }
    .miniaturas img,
    .mais {
      width: 72px;
      height: 72px;
      border-radius: 12px;
    }
    .miniaturas img {
      object-fit: cover;
      background: #fff;
    }
    .mais {
      background: var(--dark2);
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bloco {
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .bloco__topo {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .rot {
      font-size: 14px;
      font-weight: 500;
      color: var(--muted);
    }
    .grande {
      font-family: var(--font-display);
      font-size: 32px;
      font-weight: 700;
      line-height: 1;
    }
    .grande small {
      font-family: var(--font);
      font-size: 14px;
      font-weight: 500;
      color: var(--muted);
    }
    .trilha {
      height: 8px;
      border-radius: 4px;
      background: var(--soft);
      overflow: hidden;
    }
    .trilha__cheia {
      height: 100%;
      background: var(--ink);
      border-radius: 4px;
      transition: width 0.25s;
    }
    .lista {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .lista__topo {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .lista__topo h2 {
      font-size: 18px;
    }
    .ver-todas {
      min-height: 32px;
      padding: 0;
      border: 0;
      background: none;
      font-size: 14px;
      font-weight: 700;
      color: var(--accent-ink);
    }
    .proxima {
      margin: 0;
    }
    .letra {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: #e8f3b8;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
    }
  `,
})
export class Home {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const destruir = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.host.nativeElement;
      let quadro = 0;
      const atualizar = () => {
        quadro = 0;
        const t = Math.min(1, Math.max(0, (window.scrollY - ROLAGEM_INICIO) / ROLAGEM_DISTANCIA));
        const p = t * t * (3 - 2 * t); // começa e termina devagar
        el.style.setProperty('--p', p.toFixed(3));
        el.toggleAttribute('data-rolado', p > 0.6);
      };
      const aoRolar = () => {
        if (!quadro) quadro = requestAnimationFrame(atualizar);
      };
      window.addEventListener('scroll', aoRolar, { passive: true });
      atualizar();
      destruir.onDestroy(() => {
        window.removeEventListener('scroll', aoRolar);
        cancelAnimationFrame(quadro);
      });
    });
  }

  protected readonly plans = inject(PlanService);
  protected readonly exercicios = inject(ExerciseService);

  protected grupos(itens: { exerciseId: string }[]): string[] {
    return this.exercicios.gruposDe(itens.map((i) => i.exerciseId));
  }

  private readonly agora = new Date();
  protected readonly hojeISO = dataLocal(this.agora);

  protected readonly nuvem = inject(CloudService);
  protected readonly social = inject(SocialService);
  protected readonly primeiroNome = computed(() => this.nuvem.usuario()?.nome.trim().split(/\s+/)[0] ?? '');

  protected readonly saudacao =
    this.agora.getHours() < 12 ? 'Bom dia' : this.agora.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  protected readonly dataTexto = (() => {
    const t = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(this.agora);
    return t.charAt(0).toUpperCase() + t.slice(1);
  })();

  protected readonly semana = computed(() => {
    const feitos = new Set(this.plans.historico().map((s) => s.data));
    const hoje = dataLocal(this.agora);
    const diaDaSemana = (this.agora.getDay() + 6) % 7; // segunda = 0
    return LETRAS.map((letra, i) => {
      const d = new Date(this.agora);
      d.setDate(this.agora.getDate() - diaDaSemana + i);
      const data = dataLocal(d);
      const feito = feitos.has(data);
      const ehHoje = data === hoje;
      return {
        letra,
        data,
        feito,
        hoje: ehHoje,
        descricao: `${DIAS[i]}${ehHoje ? ' (hoje)' : ''}: ${feito ? 'treino feito' : 'sem treino'}`,
      };
    });
  });

  /** Último treino concluído hoje. */
  private readonly sessaoHoje = computed(() => this.plans.historico().filter((s) => s.data === this.hojeISO).at(-1) ?? null);

  /** Já treinou hoje e não há outro treino em curso: a tela mostra o resumo no lugar do botão de iniciar. */
  protected readonly concluidoHoje = computed(() => this.sessaoHoje() !== null && !this.plans.emAndamento());

  protected readonly titulo = computed(() => {
    const nome = this.primeiroNome() ? `, ${this.primeiroNome()}` : '';
    return this.concluidoHoje() ? `${this.saudacao}${nome}, treino de hoje feito!` : `${this.saudacao}${nome}, bora treinar?`;
  });

  protected readonly resumoHoje = computed(() => {
    const sessao = this.sessaoHoje();
    if (!sessao) return null;
    const registros = sessao.registros ?? [];
    const nomes = recordesDaSessao(this.plans.historico(), sessao).map((r) => this.nomeExercicio(r.exerciseId));
    const mostrados = nomes.slice(0, 2).join(', ');
    const resto = nomes.length - 2;
    const lista = resto > 0 ? `${mostrados} e mais ${resto}` : mostrados;
    return {
      sessao,
      nome: sessao.fichaNome ?? this.plans.get(sessao.fichaId)?.nome ?? 'Treino',
      exercicios: registros.length,
      series: registros.reduce((t, r) => t + r.series.length, 0),
      volume: volumeSessao(sessao),
      textoRecordes: nomes.length === 0 ? '' : `${nomes.length === 1 ? 'Novo recorde' : nomes.length + ' novos recordes'}: ${lista}`,
    };
  });

  /** Mesma meta da tela de estatísticas (a escolhida lá, ou o número de fichas). */
  private readonly metaSalva = lerMeta();
  protected readonly meta = computed(() => this.metaSalva ?? metaPadrao(this.plans.fichas().length));
  protected readonly treinosSemana = computed(() => treinosNaSemana(this.plans.historico(), this.agora));
  protected readonly percentualMeta = computed(() => Math.min(100, Math.round((this.treinosSemana() / this.meta()) * 100)));
  protected readonly textoMeta = computed(() => {
    const faltam = this.meta() - this.treinosSemana();
    if (faltam <= 0) return 'Meta da semana batida. Excelente consistência!';
    return `Faltam ${faltam} ${faltam === 1 ? 'treino' : 'treinos'} para bater a meta.`;
  });

  protected readonly conquistas = computed(() => ordenarPorNivel(calcularConquistas(this.plans.historico(), this.meta(), { hoje: this.agora, regiaoDe: (id) => regiaoDoExercicio(this.exercicios.get(id)) })));
  protected readonly proxima = computed(() => proximaConquista(this.conquistas()));
  protected readonly nomes = NOMES_NIVEL;
  protected readonly resumoConquistas = computed(() => {
    const degraus = this.conquistas().flatMap((c) => c.degraus);
    return `${degraus.filter((d) => d.conquistado).length} de ${degraus.length} níveis conquistados`;
  });
  protected readonly recordesRecentes = computed(() =>
    historicoDeRecordes(this.plans.historico())
      .slice(-5)
      .reverse()
      .map((r) => ({ nome: this.nomeExercicio(r.exerciseId), carga: r.carga, data: r.data })),
  );

  protected readonly galeriaAberta = signal(false);
  protected readonly sessaoAberta = signal(false);
  protected readonly exercicioAberto = signal<string | null>(null);

  private nomeExercicio(id: string): string {
    const e = this.exercicios.get(id);
    return e ? this.exercicios.nome(e) : id;
  }

  protected progresso(id: TipoConquista, atual: number, alvo: number): string {
    return formatarProgresso(id, atual, alvo);
  }

  protected carga(kg: number): string {
    return kg >= 1000 ? `${(kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t` : `${Math.round(kg)} kg`;
  }
}
