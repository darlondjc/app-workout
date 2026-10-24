import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AtividadeDialogo } from '../core/atividade-dialogo';
import { resumoAtividade } from '../core/atividade';
import { Avatar } from '../core/avatar';
import { BarraTopo } from '../core/barra-topo';
import { CloudService } from '../core/cloud.service';
import { Dialogo } from '../core/dialogo';
import { ExercicioDialogo } from '../core/exercicio-dialogo';
import { ExerciseService } from '../core/exercise.service';
import { Icon } from '../core/icon';
import { MedalhasGaleria } from '../core/medalhas-galeria';
import { NOMES_NIVEL, TipoConquista, formatarProgresso, historicoDeRecordes, ordenarPorNivel, proximaConquista } from '../core/medalhas';
import { MedalhasService } from '../core/medalhas.service';
import { QuadroMedalhas } from '../core/quadro-medalhas';
import { lerMeta, metaPadrao } from '../core/meta';
import { SessaoDetalhe } from '../core/sessao-detalhe';
import { SocialService } from '../core/social.service';
import { PlanService, dataLocal } from '../core/plan.service';
import { AtividadeRegistro } from '../core/models';
import { ToastService } from '../core/toast.service';
import { recordesDaSessao, treinosNaSemana, volumeSessao } from '../core/stats';

/** Quantas medalhas aparecem no quadro da tela inicial. */
const MEDALHAS_NA_INICIAL = 6;

const LETRAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const DIAS = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];

@Component({
  selector: 'app-home',
  imports: [RouterLink, Icon, Avatar, BarraTopo, Dialogo, ExercicioDialogo, SessaoDetalhe, MedalhasGaleria, QuadroMedalhas, AtividadeDialogo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
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

  /** Último treino concluído hoje; a atividade só aparece quando não houve treino de ficha no dia. */
  private readonly sessaoHoje = computed(() => {
    const hoje = this.plans.historico().filter((s) => s.data === this.hojeISO);
    return hoje.filter((s) => s.fichaId).at(-1) ?? hoje.at(-1) ?? null;
  });

  /** Já treinou hoje e não há outro treino em curso: a tela mostra o resumo no lugar do botão de iniciar. */
  protected readonly concluidoHoje = computed(() => this.sessaoHoje() !== null && !this.plans.emAndamento());

  protected readonly titulo = computed(() => {
    const nome = this.primeiroNome() ? `, ${this.primeiroNome()}` : '';
    return this.concluidoHoje() ? `${this.saudacao}${nome}, treino de hoje feito!` : `${this.saudacao}${nome}, bora treinar?`;
  });

  protected readonly resumoHoje = computed(() => {
    const sessao = this.sessaoHoje();
    if (!sessao) return null;
    if (sessao.atividade) {
      return { sessao, nome: sessao.atividade.nome, atividade: resumoAtividade(sessao.atividade), exercicios: 0, series: 0, volume: 0, textoRecordes: '' };
    }
    const registros = sessao.registros ?? [];
    const nomes = recordesDaSessao(this.plans.historico(), sessao).map((r) => this.nomeExercicio(r.exerciseId));
    const mostrados = nomes.slice(0, 2).join(', ');
    const resto = nomes.length - 2;
    const lista = resto > 0 ? `${mostrados} e mais ${resto}` : mostrados;
    return {
      sessao,
      atividade: '',
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

  private readonly medalhas = inject(MedalhasService);
  /** Medalhas guardadas no fim do último treino (nada é recalculado a cada tela). */
  protected readonly conquistas = computed(() => ordenarPorNivel(this.medalhas.conquistas()));
  protected readonly novasIds = this.medalhas.idsNovos;
  /** Na tela inicial só as melhores (as de maior nível, já que a lista vem ordenada); o resto fica em "Ver todas". */
  protected readonly melhores = computed(() => {
    // As que subiram de nível vão primeiro, para o destaque nunca ficar escondido em "Ver todas".
    const novas = this.novasIds();
    const todas = this.conquistas();
    return [...todas.filter((c) => novas.includes(c.id)), ...todas.filter((c) => !novas.includes(c.id))].slice(0, MEDALHAS_NA_INICIAL);
  });
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
  protected readonly focoGaleria = signal<TipoConquista | null>(null);
  /** Novas congeladas enquanto a galeria está aberta (o realce fica até fechar). */
  protected readonly novasNaGaleria = signal<TipoConquista[]>([]);

  protected abrirGaleria(foco: TipoConquista | null): void {
    this.novasNaGaleria.set([...this.novasIds()]);
    // Sem medalha tocada, mas com novas: vai até a primeira nova.
    this.focoGaleria.set(foco ?? this.novasIds()[0] ?? null);
    this.galeriaAberta.set(true);
  }

  protected fecharGaleria(): void {
    this.galeriaAberta.set(false);
    this.focoGaleria.set(null);
    this.medalhas.reconhecer();
  }
  protected readonly sessaoAberta = signal(false);
  protected readonly adicionandoAtividade = signal(false);
  private readonly toast = inject(ToastService);

  /** Grava a atividade (que vale como o treino do dia) e manda a foto, se houver, para a timeline. */
  protected adicionarAtividade(dados: { atividade: AtividadeRegistro; foto: string | null }): void {
    const id = this.plans.registrarAtividade(dados.atividade, dados.foto !== null);
    this.medalhas.aposTreino(id);
    if (dados.foto) void this.social.salvarFoto(id, dados.foto);
    this.adicionandoAtividade.set(false);
    this.toast.mostrar(`${dados.atividade.nome} registrada!`);
  }
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
