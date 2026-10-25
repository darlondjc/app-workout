import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Avatar } from '../core/avatar';
import { Icon } from '../core/icon';
import { NavegacaoService } from '../core/navegacao.service';
import { SocialService } from '../core/social.service';
import { Carregando } from '../core/spinner';
import { Progress } from './progress';

/** Estatísticas de uma pessoa de um dos meus grupos (aberta ao tocar no ícone dela). */
@Component({
  selector: 'app-member-stats',
  imports: [RouterLink, Avatar, Icon, Carregando, Progress],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="cabeca">
        <button type="button" class="voltar" aria-label="Voltar" (click)="nav.voltar('/social')"><app-icon name="back" [size]="20" [stroke]="2.2" /></button>
        @if (perfil(); as p) {
          <app-avatar [usuario]="{ uid: p.uid, nome: p.nome, email: '', foto: p.foto }" [tamanho]="44" />
          <h1 class="titulo nome">{{ p.nome }}</h1>
        }
      </header>

      @if (!social.ativo()) {
        @if (social.erro()) {
          <p class="erro" role="alert">{{ social.erro() }}</p>
        } @else {
          <app-carregando texto="Conectando…" />
        }
      } @else if (!social.conexoesCarregadas()) {
        <app-carregando texto="Carregando…" />
      } @else if (!social.podeVer(uid())) {
        <div class="card vazio">
          <h2 class="sub">Estatísticas indisponíveis</h2>
          <p class="apoio">Você só vê as estatísticas de quem está em um grupo com você.</p>
          <a class="btn btn--escuro" routerLink="/social">Ver meus grupos</a>
        </div>
      } @else if (carregado()) {
        <app-progress [historico]="sessoes()" [editavel]="false" [nome]="primeiroNome()" [metaBase]="perfil()?.metaSemanal" />
      } @else {
        <app-carregando texto="Carregando treinos…" />
      }
    </section>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: 16px; }
    .cabeca { display: flex; align-items: center; gap: 10px; }
    .voltar { flex: none; width: 44px; height: 44px; border: 0; border-radius: 50%; background: var(--soft); color: var(--ink); display: flex; align-items: center; justify-content: center; }
    .nome { flex: 1; min-width: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 24px; }
    .vazio { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
    .sub { font-size: 18px; margin: 0; }
    .erro { color: #b3261e; font-size: 14px; }
  `,
})
export class MemberStats {
  protected readonly social = inject(SocialService);
  protected readonly nav = inject(NavegacaoService);
  private readonly router = inject(Router);

  /** Identificador da pessoa, vindo da rota (`/membro/:uid`). */
  readonly uid = input.required<string>();

  protected readonly perfil = computed(() => this.social.perfilDe(this.uid()));
  protected readonly sessoes = computed(() => this.social.sessoesDe(this.uid()));
  protected readonly carregado = computed(() => {
    this.social.sessoesDe(this.uid()); // começa a acompanhar os treinos da pessoa
    return this.social.sessoesCarregadas(this.uid());
  });
  protected readonly primeiroNome = computed(() => {
    const nome = this.perfil()?.nome ?? '';
    return nome.trim().split(/\s+/)[0] || nome;
  });

  constructor() {
    // As estatísticas da própria pessoa ficam no Perfil.
    effect(() => {
      if (this.social.eu()?.uid === this.uid()) untracked(() => void this.router.navigateByUrl('/perfil', { replaceUrl: true }));
    });
    // Traz a meta mais recente da pessoa.
    effect(() => {
      const uid = this.uid();
      if (this.social.ativo() && this.social.podeVer(uid)) untracked(() => void this.social.atualizarPerfil(uid));
    });
  }
}
