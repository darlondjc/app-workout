import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Exercise } from '../core/models';
import { ExerciseService, GRUPOS } from '../core/exercise.service';
import { Icon } from '../core/icon';
import { PlanService } from '../core/plan.service';
import { ToastService } from '../core/toast.service';

const PAGINA = 40;

@Component({
  selector: 'app-library',
  imports: [RouterLink, Icon],
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
            Carregando…
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
      outline: 3px solid #4a6a00;
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
  protected readonly consulta = signal('');
  protected readonly grupo = signal('');
  private readonly equip = signal('');
  private readonly nivel = signal('');
  private readonly limite = signal(PAGINA);

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
