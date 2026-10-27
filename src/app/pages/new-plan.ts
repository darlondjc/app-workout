import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Icon, IconName } from '../core/icon';
import { NavegacaoService } from '../core/navegacao.service';
import { PlanService } from '../core/plan.service';

interface Caminho {
  titulo: string;
  explicacao: string;
  ideal: string;
  icone: IconName;
}

/** Ponto de partida para criar uma ficha: três caminhos, cada um com a sua explicação. */
@Component({
  selector: 'app-new-plan',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header>
        <button type="button" class="voltar" (click)="nav.voltar('/fichas')"><app-icon name="back" [size]="18" [stroke]="2.2" /> Voltar</button>
        <h1 class="titulo">Nova ficha</h1>
        <p class="apoio">Como você quer criar?</p>
      </header>

      <ul class="caminhos">
        <li>
          <button type="button" class="caminho" (click)="manual()">
            <span class="caminho__icone"><app-icon [name]="manualInfo.icone" [size]="24" [stroke]="2" /></span>
            <span class="caminho__txt">
              <strong>{{ manualInfo.titulo }}</strong>
              <span>{{ manualInfo.explicacao }}</span>
              <span class="ideal">{{ manualInfo.ideal }}</span>
            </span>
            <app-icon class="seta" name="chevron" [size]="18" [stroke]="2.2" />
          </button>
        </li>
        <li>
          <a class="caminho" routerLink="/fichas/sugestao">
            <span class="caminho__icone"><app-icon [name]="sugestaoInfo.icone" [size]="24" [stroke]="2" /></span>
            <span class="caminho__txt">
              <strong>{{ sugestaoInfo.titulo }}</strong>
              <span>{{ sugestaoInfo.explicacao }}</span>
              <span class="ideal">{{ sugestaoInfo.ideal }}</span>
            </span>
            <app-icon class="seta" name="chevron" [size]="18" [stroke]="2.2" />
          </a>
        </li>
        <li>
          <a class="caminho" routerLink="/fichas/personalizada">
            <span class="caminho__icone"><app-icon [name]="personalizadaInfo.icone" [size]="24" [stroke]="2" /></span>
            <span class="caminho__txt">
              <strong>{{ personalizadaInfo.titulo }}</strong>
              <span>{{ personalizadaInfo.explicacao }}</span>
              <span class="ideal">{{ personalizadaInfo.ideal }}</span>
            </span>
            <app-icon class="seta" name="chevron" [size]="18" [stroke]="2.2" />
          </a>
        </li>
      </ul>

      <aside class="card aviso" aria-label="Como a ficha nova funciona">
        <p class="apoio">
          A ficha vale por <strong>{{ plans.mesesPadrao() }} {{ plans.mesesPadrao() === 1 ? 'mês' : 'meses' }}</strong>. Você pode mudar a data de fim
          dela depois, e a duração padrão fica em Perfil.
        </p>
        @if (atuais(); as a) {
          <p class="apoio">
            Ao criar a ficha nova, <strong>{{ a }}</strong> {{ plans.blocosAtivos().length === 1 ? 'é encerrada' : 'são encerradas' }} hoje e
            {{ plans.blocosAtivos().length === 1 ? 'vai' : 'vão' }} para as fichas vencidas, de onde você pode renovar ou arquivar.
          </p>
        }
      </aside>
    </section>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: 14px; }
    header .apoio { margin: 0; }
    .caminhos { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .caminho { width: 100%; display: flex; align-items: center; gap: 14px; padding: 16px 14px; border: 1px solid var(--line); border-radius: 18px; background: var(--card); color: var(--ink); font: inherit; text-align: left; text-decoration: none; }
    .caminho__icone { flex: none; width: 48px; height: 48px; border-radius: 14px; background: var(--accent-soft); display: flex; align-items: center; justify-content: center; }
    .caminho__txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; font-size: 14px; line-height: 1.35; }
    .caminho__txt strong { font-family: var(--font-display); font-size: 18px; }
    .ideal { color: var(--muted); font-size: 13px; }
    .seta { flex: none; color: var(--muted); }
    .aviso { padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
    .aviso .apoio { margin: 0; }
  `,
})
export class NewPlan {
  protected readonly plans = inject(PlanService);
  protected readonly nav = inject(NavegacaoService);
  private readonly router = inject(Router);

  protected readonly manualInfo: Caminho = {
    titulo: 'Montar do zero',
    explicacao: 'Você escolhe cada exercício na biblioteca e ajusta séries, repetições e carga.',
    ideal: 'Para quem já sabe o que quer treinar.',
    icone: 'plus',
  };
  protected readonly sugestaoInfo: Caminho = {
    titulo: 'Sugestão automática',
    explicacao: 'Responda quatro perguntas rápidas (objetivo, experiência, dias por semana e onde treina) e o app monta a ficha pronta.',
    ideal: 'Para quem quer começar sem pensar muito.',
    icone: 'clipboard',
  };
  protected readonly personalizadaInfo: Caminho = {
    titulo: 'Personalizada',
    explicacao: 'Você define quantos treinos, os músculos de cada dia e se tem cardio. O app escolhe os exercícios e você ajusta.',
    ideal: 'Para quem quer controle sem montar tudo à mão.',
    icone: 'settings',
  };

  /** Nomes das fichas ativas, que serão encerradas quando a nova for criada. */
  protected readonly atuais = computed(() => {
    const nomes = this.plans.blocosAtivos().map((b) => `"${b.nome}"`);
    if (nomes.length === 0) return '';
    return nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
  });

  protected manual(): void {
    const ficha = this.plans.criarRascunho(`Ficha ${String.fromCharCode(65 + (this.plans.blocos().length % 26))}`);
    void this.router.navigate(['/ficha', ficha.id]);
  }
}
