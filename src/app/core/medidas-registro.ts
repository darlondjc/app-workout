import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { dataCurta } from './data-texto';
import { Icon } from './icon';
import { ChaveMedida, MEDIDAS, ValoresMedidas, formatarMedida, lerMedida, ultimasMedidas } from './medidas';
import { MedidasService } from './medidas.service';
import { RegistroMedidas } from './models';
import { dataISO } from './stats';
import { ToastService } from './toast.service';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Perfil: bioimpedância e circunferência abdominal, registradas à parte do peso (cada campo é opcional). */
@Component({
  selector: 'app-medidas-registro',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card bloco" aria-labelledby="t-medidas">
      <h2 id="t-medidas" class="sub">Bioimpedância e medidas</h2>

      @if (ultimas().length > 0) {
        <dl class="atuais">
          @for (u of ultimas(); track u.medida.chave) {
            <div>
              <dt>{{ u.medida.rotulo }}</dt>
              <dd>{{ valor(u.valor, u.medida) }} <small>{{ u.medida.unidade }} · {{ dia(u.data) }}</small></dd>
            </div>
          }
        </dl>
      } @else {
        <p class="apoio">Registre o resultado da bioimpedância ou a circunferência abdominal. Não precisa preencher tudo, nem junto com o peso.</p>
      }

      <form class="form" (submit)="salvar($event)" novalidate>
        @for (m of medidas; track m.chave) {
          <label class="campo">
            <span class="apoio">{{ m.rotulo }} ({{ m.unidade }})</span>
            <input type="text" inputmode="decimal" autocomplete="off" [placeholder]="exemplo(m.chave)" [value]="texto()[m.chave]" (input)="digitou(m.chave, $event)" />
          </label>
        }
        <label class="campo">
          <span class="apoio">Dia</span>
          <span class="data">
            <span class="data__texto">{{ textoDia() }}</span>
            <input #campoDia type="date" aria-label="Dia" [value]="data()" [max]="hoje" (input)="data.set(campoDia.value)" />
          </span>
        </label>
        <button type="submit" class="btn btn--escuro">Registrar</button>
      </form>
      @if (erro()) {
        <p class="apoio erro" role="alert">{{ erro() }}</p>
      }

      @if (servico.registros().length > 0) {
        <details class="historico">
          <summary>Histórico ({{ servico.registros().length }})</summary>
          <ul>
            @for (r of recentes(); track r.data) {
              <li>
                <span>{{ dia(r.data) }}</span>
                <small>{{ resumo(r) }}</small>
                <button type="button" class="apagar" [attr.aria-label]="'Apagar as medidas de ' + dia(r.data)" (click)="apagar(r.data)">
                  <app-icon name="trash" [size]="18" [stroke]="2" />
                </button>
              </li>
            }
          </ul>
        </details>
      }
    </article>
  `,
  styles: `
    .bloco { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .sub { margin: 0; font-size: 15px; color: var(--muted); font-weight: 500; }
    .atuais { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; margin: 0; }
    .atuais div { min-width: 0; }
    .atuais dt { font-size: 12px; color: var(--muted); }
    .atuais dd { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 20px; }
    .atuais small { font-family: var(--font); font-weight: 500; color: var(--muted); font-size: 12px; }
    .form { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
    .form .btn { grid-column: 1 / -1; }
    .campo { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .campo input:not([type='date']) {
      display: block;
      width: 100%;
      min-width: 0;
      max-width: 100%;
      height: 48px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--card);
      -webkit-appearance: none;
      appearance: none;
    }
    .data { position: relative; display: flex; align-items: center; height: 48px; box-sizing: border-box; padding: 0 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
    .data:focus-within { outline: 2px solid var(--ink); outline-offset: 2px; }
    .data__texto { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .data input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; opacity: 0; cursor: pointer; -webkit-appearance: none; appearance: none; }
    .erro { color: var(--perigo); }
    .historico summary { min-height: 44px; display: flex; align-items: center; font-weight: 700; font-size: 14px; cursor: pointer; }
    .historico ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .historico li { display: flex; align-items: center; gap: 12px; padding: 4px 0; border-top: 1px solid var(--soft); font-size: 14px; }
    .historico li span { flex: none; }
    .historico li small { flex: 1; min-width: 0; color: var(--muted); font-size: 12px; }
    .apagar { flex: none; width: 44px; height: 44px; border: 0; border-radius: 50%; background: none; color: var(--muted); display: flex; align-items: center; justify-content: center; }
  `,
})
export class MedidasRegistro {
  protected readonly servico = inject(MedidasService);
  private readonly toast = inject(ToastService);

  protected readonly hoje = dataISO(new Date());
  protected readonly medidas = MEDIDAS;
  protected readonly texto = signal<Record<ChaveMedida, string>>(this.vazios());
  protected readonly data = signal(this.hoje);
  protected readonly erro = signal('');

  protected readonly ultimas = computed(() => ultimasMedidas(this.servico.registros()));
  protected readonly recentes = computed(() => this.servico.registros().slice(-10).reverse());
  protected readonly textoDia = computed(() => {
    const d = this.data();
    if (!ISO.test(d)) return 'Escolha o dia';
    return d === this.hoje ? `Hoje · ${dataCurta(d)}` : dataCurta(d);
  });

  private vazios(): Record<ChaveMedida, string> {
    return { gordura: '', musculo: '', visceral: '', cintura: '', tmb: '' };
  }

  protected digitou(chave: ChaveMedida, e: Event): void {
    const valor = (e.target as HTMLInputElement).value;
    this.texto.update((t) => ({ ...t, [chave]: valor }));
  }

  /** Mostra o último valor informado como sugestão do que digitar. */
  protected exemplo(chave: ChaveMedida): string {
    const u = this.ultimas().find((x) => x.medida.chave === chave);
    return u ? formatarMedida(u.valor, u.medida) : '';
  }

  protected salvar(e: Event): void {
    e.preventDefault();
    const valores: ValoresMedidas = {};
    for (const m of MEDIDAS) {
      const v = lerMedida(this.texto()[m.chave], m);
      if (v === null) {
        this.erro.set(`${m.rotulo}: digite um valor entre ${m.min} e ${m.max} ${m.unidade}.`);
        return;
      }
      if (v !== undefined) valores[m.chave] = v;
    }
    if (Object.keys(valores).length === 0) {
      this.erro.set('Preencha pelo menos uma medida.');
      return;
    }
    const dia = this.data();
    if (!ISO.test(dia)) {
      this.erro.set('Escolha o dia da medição.');
      return;
    }
    if (dia > this.hoje) {
      this.erro.set('Não dá para registrar medidas de um dia que ainda não chegou.');
      return;
    }
    this.servico.registrar(dia, valores);
    this.texto.set(this.vazios());
    this.erro.set('');
    this.toast.mostrar('Medidas registradas');
  }

  protected apagar(data: string): void {
    const r = this.servico.remover(data);
    if (r) this.toast.mostrar('Registro apagado', { rotulo: 'Desfazer', executar: () => this.servico.restaurar(r) });
  }

  protected resumo(r: RegistroMedidas): string {
    return MEDIDAS.filter((m) => typeof r[m.chave] === 'number')
      .map((m) => `${m.rotulo.split(' ')[0]} ${formatarMedida(r[m.chave] as number, m)}`)
      .join(' · ');
  }

  protected valor = formatarMedida;

  protected dia(iso: string): string {
    return dataCurta(iso);
  }
}
