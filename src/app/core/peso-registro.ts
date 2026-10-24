import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { dataCurta, formatarKg } from './data-texto';
import { Icon } from './icon';
import { PesoService } from './peso.service';
import { PESO_MAXIMO, PESO_MINIMO, lerPeso } from './peso';
import { dataISO } from './stats';
import { ToastService } from './toast.service';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Ajustes: registra o peso do dia (ou de um dia anterior) e mostra o histórico, com opção de apagar. */
@Component({
  selector: 'app-peso-registro',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card bloco" aria-labelledby="t-peso">
      <h2 id="t-peso" class="sub">Meu peso</h2>

      @if (peso.atual(); as a) {
        <p class="grande">{{ kg(a.kg) }} <small>kg · {{ dia(a.data) }}</small></p>
      } @else {
        <p class="apoio">Registre o seu peso para acompanhar a evolução em Social, na aba Estatísticas.</p>
      }

      <form class="form" (submit)="salvar($event)" novalidate>
        <label class="campo">
          <span class="apoio">Peso (kg)</span>
          <input #campoPeso type="text" inputmode="decimal" autocomplete="off" [placeholder]="exemplo()" [value]="texto()" (input)="texto.set(campoPeso.value)" />
        </label>
        <label class="campo">
          <span class="apoio">Dia</span>
          <span class="data">
            <span class="data__texto">{{ textoDia() }}</span>
            <!-- O campo nativo fica invisível por cima: abre o seletor do aparelho, mas o visual é igual ao do peso em qualquer navegador. -->
            <input #campoDia type="date" aria-label="Dia" [value]="data()" [max]="hoje" (input)="data.set(campoDia.value)" />
          </span>
        </label>
        <button type="submit" class="btn btn--escuro">{{ jaTem() ? 'Atualizar' : 'Registrar' }}</button>
      </form>
      @if (jaTem()) {
        <p class="apoio">Já existe um peso neste dia. Registrar de novo substitui o anterior.</p>
      }
      @if (erro()) {
        <p class="apoio erro" role="alert">{{ erro() }}</p>
      }

      @if (peso.registros().length > 0) {
        <details class="historico">
          <summary>Histórico ({{ peso.registros().length }})</summary>
          <ul>
            @for (r of recentes(); track r.data) {
              <li>
                <span>{{ dia(r.data) }}</span>
                <strong>{{ kg(r.kg) }} kg</strong>
                <button type="button" class="apagar" [attr.aria-label]="'Apagar o peso de ' + dia(r.data)" (click)="apagar(r.data)">
                  <app-icon name="trash" [size]="18" [stroke]="2" />
                </button>
              </li>
            }
          </ul>
          @if (peso.registros().length > recentes().length) {
            <p class="apoio">Mostrando os {{ recentes().length }} mais recentes.</p>
          }
        </details>
      }
    </article>
  `,
  styles: `
    .bloco { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .sub { margin: 0; font-size: 15px; color: var(--muted); font-weight: 500; }
    .grande { font-family: var(--font-display); font-size: 32px; font-weight: 700; line-height: 1; margin: 0; }
    .grande small { font-family: var(--font); font-size: 14px; font-weight: 500; color: var(--muted); }
    .form { display: flex; flex-direction: column; gap: 10px; }
    .campo { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .campo input:not([type='date']) {
      display: block;
      width: 100%;
      min-width: 0;
      max-width: 100%;
      height: 48px;
      padding: 0 14px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--card);
      -webkit-appearance: none;
      appearance: none;
    }
    /* O campo de data nativo muda de altura e alinhamento conforme o navegador (no iOS o texto sobe); por isso só o texto formatado aparece. */
    .data { position: relative; display: flex; align-items: center; height: 48px; box-sizing: border-box; padding: 0 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
    .data:focus-within { outline: 2px solid var(--ink); outline-offset: 2px; }
    .data input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; opacity: 0; cursor: pointer; -webkit-appearance: none; appearance: none; }
    .erro { color: #b3261e; }
    .historico summary { min-height: 44px; display: flex; align-items: center; font-weight: 700; font-size: 14px; cursor: pointer; }
    .historico ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .historico li { display: flex; align-items: center; gap: 12px; padding: 4px 0; border-top: 1px solid var(--soft); font-size: 14px; }
    .historico li span { flex: 1; }
    .apagar { flex: none; width: 44px; height: 44px; border: 0; border-radius: 50%; background: none; color: var(--muted); display: flex; align-items: center; justify-content: center; }
  `,
})
export class PesoRegistro {
  protected readonly peso = inject(PesoService);
  private readonly toast = inject(ToastService);

  protected readonly hoje = dataISO(new Date());
  protected readonly texto = signal('');
  protected readonly data = signal(this.hoje);
  protected readonly erro = signal('');

  protected readonly jaTem = computed(() => this.peso.registros().some((r) => r.data === this.data()));
  protected readonly recentes = computed(() => this.peso.registros().slice(-15).reverse());
  protected readonly exemplo = computed(() => {
    const a = this.peso.atual();
    return a ? formatarKg(a.kg) : '72,5';
  });

  protected salvar(e: Event): void {
    e.preventDefault();
    const kg = lerPeso(this.texto());
    if (kg === null) {
      this.erro.set(`Digite um peso entre ${PESO_MINIMO} e ${PESO_MAXIMO} kg, como 72,5.`);
      return;
    }
    const dia = this.data();
    if (!ISO.test(dia)) {
      this.erro.set('Escolha o dia da pesagem.');
      return;
    }
    if (dia > this.hoje) {
      this.erro.set('Não dá para registrar o peso de um dia que ainda não chegou.');
      return;
    }
    const atualizou = this.jaTem();
    this.peso.registrar(dia, kg);
    this.texto.set('');
    this.erro.set('');
    this.toast.mostrar(atualizou ? 'Peso atualizado' : 'Peso registrado');
  }

  protected apagar(data: string): void {
    this.peso.remover(data);
    this.toast.mostrar('Registro apagado');
  }

  protected kg(v: number): string {
    return formatarKg(v);
  }

  protected readonly textoDia = computed(() => {
    const d = this.data();
    if (!ISO.test(d)) return 'Escolha o dia';
    return d === this.hoje ? `Hoje · ${dataCurta(d)}` : dataCurta(d);
  });

  protected dia(iso: string): string {
    return dataCurta(iso);
  }
}
