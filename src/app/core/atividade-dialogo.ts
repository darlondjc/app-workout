import { ChangeDetectionStrategy, Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { DISTANCIA_MAXIMA_KM, ESFORCOS, MINUTOS_MAXIMO, TIPOS_ATIVIDADE, lerNumero } from './atividade';
import { Dialogo } from './dialogo';
import { EnquadrarFoto } from './enquadrar-foto';
import { FotoBotao } from './foto-botao';
import { AtividadeRegistro } from './models';
import { SocialService } from './social.service';

/** Registro de uma atividade fora da ficha: tipo, duração, distância e esforço, com foto opcional para a timeline. */
@Component({
  selector: 'app-atividade-dialogo',
  imports: [Dialogo, FotoBotao, EnquadrarFoto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialogo titulo="Adicionar atividade" subtitulo="Conta como o treino de hoje" (fechar)="cancelar.emit()">
      <form class="form" (submit)="enviar($event)" novalidate>
        <fieldset class="grupo">
          <legend class="rot">Qual foi a atividade?</legend>
          <div class="chips">
            @for (t of tipos; track t.key) {
              <button type="button" class="chip" [class.ativo]="tipo().key === t.key" [attr.aria-pressed]="tipo().key === t.key" (click)="tipoKey.set(t.key)">{{ t.nome }}</button>
            }
          </div>
        </fieldset>

        @if (tipo().key === 'outra') {
          <label class="campo">
            <span class="apoio">Nome da atividade</span>
            <input #campoNome type="text" maxlength="30" autocomplete="off" placeholder="Ex.: Ciclismo" [value]="nomeOutra()" (input)="nomeOutra.set(campoNome.value)" />
          </label>
        }

        <div class="duas">
          <label class="campo">
            <span class="apoio">Duração (min)</span>
            <input #campoMin type="text" inputmode="numeric" autocomplete="off" placeholder="45" [value]="minutos()" (input)="minutos.set(campoMin.value)" />
          </label>
          <label class="campo">
            <span class="apoio">Distância (km) · opcional</span>
            <input #campoKm type="text" inputmode="decimal" autocomplete="off" placeholder="5,2" [value]="distancia()" (input)="distancia.set(campoKm.value)" />
          </label>
        </div>

        <fieldset class="grupo">
          <legend class="rot">Esforço · opcional</legend>
          <div class="chips">
            @for (e of esforcos; track e.key) {
              <button type="button" class="chip" [class.ativo]="esforco() === e.key" [attr.aria-pressed]="esforco() === e.key" (click)="esforco.set(esforco() === e.key ? null : e.key)">{{ e.nome }}</button>
            }
          </div>
        </fieldset>

        @if (social.ativo()) {
          @if (foto(); as f) {
            <app-enquadrar-foto [foto]="f" />
            <div class="foto-acoes">
              <app-foto-botao rotulo="Trocar foto" (escolhida)="foto.set($event)" />
              <button type="button" class="btn btn--claro" (click)="foto.set(null)">Remover</button>
            </div>
          } @else {
            <app-foto-botao rotulo="Adicionar foto (opcional)" (escolhida)="foto.set($event)" />
          }
        }

        @if (erro()) {
          <p class="erro" role="alert">{{ erro() }}</p>
        }
        <button type="submit" class="btn btn--destaque" [disabled]="salvando()">{{ salvando() ? 'Preparando a foto…' : 'Adicionar atividade' }}</button>
      </form>
    </app-dialogo>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: 14px; }
    .grupo { margin: 0; padding: 0; border: 0; min-width: 0; }
    .grupo .rot { padding: 0; margin-bottom: 8px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { min-height: 40px; padding: 0 14px; border-radius: 20px; border: 1px solid var(--line); background: var(--card); color: var(--ink); font: inherit; font-size: 14px; }
    .chip.ativo { background: var(--ink); border-color: var(--ink); color: var(--accent); font-weight: 700; }
    .duas { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .campo { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .campo input { min-height: 44px; padding: 0 12px; border-radius: 12px; border: 1px solid var(--line); font: inherit; background: var(--card); color: var(--ink); }
    .foto-acoes { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: start; }
    .erro { margin: 0; font-size: 13px; color: #b3261e; }
  `,
})
export class AtividadeDialogo {
  /** Atividade preenchida e a foto escolhida (já recortada), ou `null` sem foto. */
  readonly adicionar = output<{ atividade: AtividadeRegistro; foto: string | null }>();
  readonly cancelar = output<void>();

  protected readonly social = inject(SocialService);
  protected readonly tipos = TIPOS_ATIVIDADE;
  protected readonly esforcos = ESFORCOS;
  protected readonly tipoKey = signal(TIPOS_ATIVIDADE[0].key);
  protected readonly tipo = computed(() => TIPOS_ATIVIDADE.find((t) => t.key === this.tipoKey()) ?? TIPOS_ATIVIDADE[0]);
  protected readonly nomeOutra = signal('');
  protected readonly minutos = signal('');
  protected readonly distancia = signal('');
  protected readonly esforco = signal<AtividadeRegistro['esforco'] | null>(null);
  protected readonly foto = signal<string | null>(null);
  protected readonly erro = signal('');
  protected readonly salvando = signal(false);
  private readonly enquadrador = viewChild(EnquadrarFoto);

  protected async enviar(ev: Event): Promise<void> {
    ev.preventDefault();
    const t = this.tipo();
    const nome = t.key === 'outra' ? this.nomeOutra().trim() : t.nome;
    const minutos = lerNumero(this.minutos());
    const km = lerNumero(this.distancia());
    if (!nome) return this.erro.set('Diga qual foi a atividade.');
    if (minutos === null || !Number.isInteger(minutos) || minutos < 1 || minutos > MINUTOS_MAXIMO) {
      return this.erro.set(`Informe a duração em minutos (1 a ${MINUTOS_MAXIMO}).`);
    }
    if (this.distancia().trim() !== '' && (km === null || km <= 0 || km > DISTANCIA_MAXIMA_KM)) {
      return this.erro.set(`Informe a distância em km (até ${DISTANCIA_MAXIMA_KM}) ou deixe em branco.`);
    }
    this.erro.set('');
    const atividade: AtividadeRegistro = {
      tipo: t.key,
      nome,
      minutos,
      ...(km ? { distanciaKm: Math.round(km * 100) / 100 } : {}),
      ...(this.esforco() ? { esforco: this.esforco()! } : {}),
    };
    const original = this.foto();
    let final = original;
    if (original) {
      this.salvando.set(true);
      try {
        final = (await this.enquadrador()?.recortar()) ?? original;
      } catch {
        /* mantém a foto inteira */
      }
      this.salvando.set(false);
    }
    this.adicionar.emit({ atividade, foto: final });
  }
}
