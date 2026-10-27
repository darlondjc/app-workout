import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Exercise } from '../core/models';
import { ExerciseService, FILTRO_CARDIO, GRUPOS } from '../core/exercise.service';
import { Icon } from '../core/icon';
import { Carregando } from '../core/spinner';
import { PlanService } from '../core/plan.service';
import { ToastService } from '../core/toast.service';

const PAGINA = 40;

const ESTADO = {
  consulta: signal(''),
  grupo: signal(''),
  equip: signal(''),
  nivel: signal(''),
  limite: signal(PAGINA),
};

@Component({
  selector: 'app-library',
  imports: [RouterLink, Icon, Carregando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header>
        <h1 class="titulo">Biblioteca</h1>
        <p class="apoio">
          @if (ex.ready()) {
            {{ resultados().length }} de {{ ex.exercises().length }} exercícios
          } @else if (ex.error()) {
            Não foi possível carregar os exercícios.
          } @else {
            Carregando exercícios…
          }
        </p>
      </header>

      <label class="busca">
        <app-icon name="search" [size]="20" />
        <span class="sr-only">Buscar exercício</span>
        <input
          type="search"
          placeholder="Buscar (ex.: supino, rosca)"
          autocomplete="off"
          [value]="consulta()"
          (input)="definirConsulta($any($event.target).value)"
        />
      </label>

      <div class="chips" role="group" aria-label="Grupo muscular">
        <button type="button" class="chip" [attr.aria-pressed]="grupo() === ''" (click)="definirGrupo('')">Todos</button>
        <button type="button" class="chip" [attr.aria-pressed]="grupo() === cardio" (click)="definirGrupo(cardio)">Cardio</button>
        @for (g of grupos; track g.key) {
          <button type="button" class="chip" [attr.aria-pressed]="grupo() === g.key" (click)="definirGrupo(g.key)">
            {{ g.label }}
          </button>
        }
      </div>

      <div class="filtros">
        <label>
          <span class="sr-only">Equipamento</span>
          <select class="select" (change)="definirEquip($any($event.target).value)">
            <option value="">Equipamento</option>
            @for (o of ex.equipamentos(); track o.key) {
              <option [value]="o.key">{{ o.label }}</option>
            }
          </select>
        </label>
        <label>
          <span class="sr-only">Nível</span>
          <select class="select" (change)="definirNivel($any($event.target).value)">
            <option value="">Nível</option>
            @for (o of ex.niveis(); track o.key) {
              <option [value]="o.key">{{ o.label }}</option>
            }
          </select>
        </label>
      </div>

      <ul class="resultados">
        @for (e of visiveis(); track e.id) {
          <li class="card linha">
            <a class="linha__link" [routerLink]="['/exercicio', e.id]">
              <img class="thumb" [src]="ex.imagem(e.id, 0)" alt="" loading="lazy" decoding="async" />
              <span class="linha__texto">
                <span class="linha__nome">{{ ex.nome(e) }}</span>
                <span class="apoio">{{ subtitulo(e) }}</span>
              </span>
            </a>
            <button type="button" class="btn-icone" [attr.aria-label]="'Adicionar ' + ex.nome(e) + ' à ficha'" (click)="adicionar(e)">
              <app-icon name="plus" [size]="20" [stroke]="2.5" />
            </button>
          </li>
        } @empty {
          @if (ex.ready()) {
            <li class="apoio vazio">Nenhum exercício encontrado. Tente outro termo ou limpe os filtros.</li>
          } @else if (ex.error()) {
            <li class="vazio">
              <button type="button" class="btn btn--escuro" (click)="ex.carregar()">Tentar de novo</button>
            </li>
          } @else {
            <li><app-carregando texto="Carregando exercícios…" /></li>
          }
        }
      </ul>

      @if (resultados().length > visiveis().length) {
        <button type="button" class="btn btn--claro" (click)="mostrarMais()">Mostrar mais</button>
      }
    </section>
  `,
  styles: `
    .busca {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 52px;
      padding: 0 16px;
      border-radius: 16px;
      background: var(--card);
      color: var(--muted);
    }
    .busca input {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      background: transparent;
      font-size: 16px;
      color: var(--ink);
    }
    .busca:focus-within {
      outline: 3px solid var(--foco);
    }
    .filtros {
      display: flex;
      gap: 8px;
    }
    .resultados {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .linha__link {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .vazio {
      padding: 24px 0;
      text-align: center;
    }
  `,
})
export class Library {
  protected readonly ex = inject(ExerciseService);
  private readonly plans = inject(PlanService);
  private readonly toast = inject(ToastService);

  protected readonly grupos = GRUPOS;
  protected readonly cardio = FILTRO_CARDIO;
  // Busca e filtros ficam guardados fora do componente: ao voltar de um exercício, a lista continua igual.
  protected readonly consulta = ESTADO.consulta;
  protected readonly grupo = ESTADO.grupo;
  private readonly equip = ESTADO.equip;
  private readonly nivel = ESTADO.nivel;
  private readonly limite = ESTADO.limite;

  protected readonly resultados = computed(() =>
    this.ex.buscar(this.consulta(), this.grupo(), this.equip(), this.nivel()),
  );
  protected readonly visiveis = computed(() => this.resultados().slice(0, this.limite()));

  protected definirConsulta(v: string): void {
    this.consulta.set(v);
    this.limite.set(PAGINA);
  }
  protected definirGrupo(v: string): void {
    this.grupo.set(v);
    this.limite.set(PAGINA);
  }
  protected definirEquip(v: string): void {
    this.equip.set(v);
    this.limite.set(PAGINA);
  }
  protected definirNivel(v: string): void {
    this.nivel.set(v);
    this.limite.set(PAGINA);
  }
  protected mostrarMais(): void {
    this.limite.update((n) => n + PAGINA);
  }

  protected subtitulo(e: Exercise): string {
    const musculo = e.primaryMuscles[0] ? this.ex.musculo(e.primaryMuscles[0]) : this.ex.categoria(e.category);
    return `${musculo} · ${this.ex.equipamento(e.equipment)}`;
  }

  protected adicionar(e: Exercise): void {
    const { ficha, jaEstava } = this.plans.adicionar(e.id);
    this.toast.mostrar(jaEstava ? `Já está em “${ficha.nome}”` : `Adicionado a “${ficha.nome}”`);
  }
}
