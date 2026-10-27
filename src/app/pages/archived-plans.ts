import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlocoFichas, dataCurta } from '../core/ciclo';
import { Confirmacao } from '../core/confirmacao';
import { Icon } from '../core/icon';
import { NavegacaoService } from '../core/navegacao.service';
import { PlanService } from '../core/plan.service';
import { ToastService } from '../core/toast.service';

/** Fichas arquivadas: guardadas para consulta, fora das listas e do treino sugerido. */
@Component({
  selector: 'app-archived-plans',
  imports: [Confirmacao, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header>
        <button type="button" class="voltar" (click)="nav.voltar('/fichas')"><app-icon name="back" [size]="18" [stroke]="2.2" /> Voltar</button>
        <h1 class="titulo">Fichas arquivadas</h1>
        <p class="apoio">Guardadas para consulta. Reative uma para voltar a usá-la.</p>
      </header>

      <ul class="lista">
        @for (b of plans.blocosArquivados(); track b.chave) {
          <li class="card bloco">
            <div class="bloco__topo">
              <strong class="bloco__nome">{{ b.nome }}</strong>
              <span class="apoio">{{ b.fichas.length }} {{ b.fichas.length === 1 ? 'treino' : 'treinos' }} · {{ periodo(b) }}</span>
            </div>
            <ul class="treinos">
              @for (f of b.fichas; track f.id) {
                <li><a [routerLink]="['/ficha', f.id]">{{ f.nome }}</a> <span class="apoio">{{ f.itens.length }} exerc.</span></li>
              }
            </ul>
            <div class="acoes">
              <button type="button" class="btn btn--claro" (click)="reativar(b)">Reativar</button>
              <button type="button" class="btn btn--claro perigo" aria-haspopup="dialog" (click)="excluindo.set(b)">Excluir</button>
            </div>
          </li>
        } @empty {
          <li class="apoio vazio">Nenhuma ficha arquivada.</li>
        }
      </ul>

      @if (excluindo(); as b) {
        <app-confirmacao titulo="Excluir ficha?" [subtitulo]="b.nome" mensagem="Ela e seus treinos serão excluídos. Essa ação não pode ser desfeita." rotulo="Excluir" (confirmar)="excluir(b)" (cancelar)="excluindo.set(null)" />
      }
    </section>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: 14px; }
    .lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .bloco { padding: 14px; display: flex; flex-direction: column; gap: 8px; }
    .bloco__topo { display: flex; flex-direction: column; }
    .bloco__nome { font-family: var(--font-display); font-size: 17px; }
    .treinos { list-style: none; margin: 0; padding: 0; }
    .treinos li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid var(--soft); font-size: 14px; }
    .acoes { display: flex; gap: 8px; }
    .acoes .btn { flex: 1; }
    .perigo { color: var(--perigo); }
    .vazio { padding: 24px 0; text-align: center; }
  `,
})
export class ArchivedPlans {
  protected readonly plans = inject(PlanService);
  protected readonly nav = inject(NavegacaoService);
  private readonly toast = inject(ToastService);
  protected readonly excluindo = signal<BlocoFichas | null>(null);

  protected periodo(b: BlocoFichas): string {
    if (b.inicio && b.fim) return `${dataCurta(b.inicio)} a ${dataCurta(b.fim)}`;
    return b.fim ? `até ${dataCurta(b.fim)}` : 'sem período';
  }

  protected reativar(b: BlocoFichas): void {
    this.plans.reativarBloco(b.chave);
    this.toast.mostrar(`"${b.nome}" reativada`);
  }

  protected excluir(b: BlocoFichas): void {
    this.plans.removerBloco(b.chave);
    this.excluindo.set(null);
  }
}
