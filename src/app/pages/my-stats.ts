import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Dialogo } from '../core/dialogo';
import { Icon } from '../core/icon';
import { TipoConquista, ordenarPorNivel } from '../core/medalhas';
import { MedalhasFaixa } from '../core/medalhas-faixa';
import { MedalhasGaleria } from '../core/medalhas-galeria';
import { MedalhasService } from '../core/medalhas.service';
import { NavegacaoService } from '../core/navegacao.service';
import { PlanService } from '../core/plan.service';
import { Progress } from './progress';

/** As estatísticas da própria pessoa, abertas pelo ícone no topo do Perfil: calendário, medalhas conquistadas e o resto. */
@Component({
  selector: 'app-my-stats',
  imports: [Dialogo, Icon, MedalhasFaixa, MedalhasGaleria, Progress],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="cabeca">
        <button type="button" class="voltar" aria-label="Voltar" (click)="nav.voltar('/perfil')"><app-icon name="back" [size]="20" [stroke]="2.2" /></button>
        <h1 class="titulo">Minhas estatísticas</h1>
      </header>
      <app-progress [historico]="plans.historico()" [calendarioPrimeiro]="true">
        <section class="medalhas" aria-labelledby="t-med">
          <div class="medalhas__topo">
            <h2 id="t-med" class="sub">Medalhas</h2>
            <button type="button" class="ver-todas" aria-haspopup="dialog" (click)="abrirGaleria(null)">Ver todas</button>
          </div>
          <app-medalhas-faixa [conquistas]="conquistas()" (abrir)="abrirGaleria($event)" />
        </section>
      </app-progress>

      @if (galeriaAberta()) {
        <app-dialogo titulo="Medalhas" [subtitulo]="resumoConquistas()" (fechar)="fecharGaleria()">
          <app-medalhas-galeria [conquistas]="conquistas()" [foco]="foco()" [novas]="novasNaGaleria()" />
        </app-dialogo>
      }
    </section>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: 16px; }
    .cabeca { display: flex; align-items: center; gap: 10px; }
    .voltar { flex: none; width: 44px; height: 44px; border: 0; border-radius: 50%; background: var(--soft); color: var(--ink); display: flex; align-items: center; justify-content: center; }
    .titulo { margin: 0; font-size: 24px; }
    .medalhas { display: flex; flex-direction: column; gap: 10px; }
    .medalhas__topo { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .sub { font-size: 18px; margin: 0; }
    .ver-todas { min-height: 32px; padding: 0; border: 0; background: none; font: inherit; font-size: 14px; font-weight: 700; color: var(--accent-ink); }
  `,
})
export class MyStats {
  protected readonly plans = inject(PlanService);
  protected readonly nav = inject(NavegacaoService);
  private readonly medalhas = inject(MedalhasService);

  /** Medalhas guardadas no fim do último treino; a faixa mostra só as conquistadas. */
  protected readonly conquistas = computed(() => ordenarPorNivel(this.medalhas.conquistas()));
  protected readonly resumoConquistas = computed(() => {
    const degraus = this.conquistas().flatMap((c) => c.degraus);
    return `${degraus.filter((d) => d.conquistado).length} de ${degraus.length} níveis conquistados`;
  });

  protected readonly galeriaAberta = signal(false);
  protected readonly foco = signal<TipoConquista | null>(null);
  /** Novas congeladas enquanto a galeria está aberta (o realce fica até fechar). */
  protected readonly novasNaGaleria = signal<TipoConquista[]>([]);

  protected abrirGaleria(foco: TipoConquista | null): void {
    this.novasNaGaleria.set([...this.medalhas.idsNovos()]);
    this.foco.set(foco ?? this.medalhas.idsNovos()[0] ?? null);
    this.galeriaAberta.set(true);
  }

  protected fecharGaleria(): void {
    this.galeriaAberta.set(false);
    this.foco.set(null);
    this.medalhas.reconhecer();
  }
}
