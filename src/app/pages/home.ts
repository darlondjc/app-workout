import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar } from '../core/avatar';
import { CloudService } from '../core/cloud.service';
import { ExerciseService } from '../core/exercise.service';
import { Icon } from '../core/icon';
import { SocialService } from '../core/social.service';
import { PlanService, dataLocal } from '../core/plan.service';

const LETRAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const DIAS = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];

@Component({
  selector: 'app-home',
  imports: [RouterLink, Icon, Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="cabeca">
        <div>
          <p class="apoio">{{ dataTexto }}</p>
          <h1 class="titulo">{{ saudacao }}{{ primeiroNome() ? ', ' + primeiroNome() : '' }}, bora treinar?</h1>
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

      @if (plans.proxima(); as ficha) {
        <article class="destaque">
          <div class="destaque__topo">
            <div>
              <p class="destaque__rotulo">Treino de hoje · Ficha {{ plans.letra(ficha.id) }}</p>
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
          <a class="btn btn--claro" routerLink="/fichas/sugestao">Sugerir fichas para mim</a>
        </article>
      }

      @if (!plans.treinouHoje()) {
        <a class="btn btn--claro" routerLink="/treino-do-dia">
          <app-icon name="clipboard" [size]="18" [stroke]="2.2" /> Treino customizado para hoje
        </a>
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
                <span class="apoio">{{ f.itens.length }} {{ f.itens.length === 1 ? 'exercício' : 'exercícios' }}</span>
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
    </section>
  `,
  styles: `
    .cabeca {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
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
      font-size: 14px;
      font-weight: 700;
      color: var(--accent-ink);
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
  protected readonly plans = inject(PlanService);
  protected readonly exercicios = inject(ExerciseService);

  protected grupos(itens: { exerciseId: string }[]): string[] {
    return this.exercicios.gruposDe(itens.map((i) => i.exerciseId));
  }

  private readonly agora = new Date();

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
}
