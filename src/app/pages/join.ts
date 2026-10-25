import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SocialService } from '../core/social.service';
import { Carregando } from '../core/spinner';

/** Abre um link de convite (`/convite/:codigo`): em grupo aberto a pessoa entra na hora; senão pede para entrar. */
@Component({
  selector: 'app-join',
  imports: [RouterLink, Carregando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      @if (mensagem(); as m) {
        <div class="card bloco">
          <h1 class="sub">{{ m.titulo }}</h1>
          <p class="apoio">{{ m.texto }}</p>
          <a class="btn btn--escuro" routerLink="/social">Ver meus grupos</a>
        </div>
      } @else {
        <app-carregando texto="Abrindo convite…" />
      }
    </section>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: 16px; padding-top: 24px; }
    .bloco { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
    .sub { font-size: 22px; margin: 0; overflow-wrap: anywhere; }
  `,
})
export class Join {
  protected readonly social = inject(SocialService);
  private readonly router = inject(Router);

  /** Código do grupo, vindo da rota (`/convite/:codigo`). */
  readonly codigo = input.required<string>();

  protected readonly mensagem = signal<{ titulo: string; texto: string } | null>(null);
  private tentou = false;

  constructor() {
    effect(() => {
      if (!this.social.ativo()) return;
      untracked(() => void this.abrir());
    });
  }

  private async abrir(): Promise<void> {
    if (this.tentou) return;
    this.tentou = true;
    const r = await this.social.entrarPorCodigo(this.codigo());
    switch (r.estado) {
      case 'entrou':
      case 'ja-membro':
        void this.router.navigate(['/grupo', r.grupo.id], { replaceUrl: true });
        break;
      case 'pedido-enviado':
        this.mensagem.set({ titulo: 'Pedido enviado', texto: `O dono de ${r.grupo.nome} precisa aceitar você. Depois disso o grupo aparece na aba Social.` });
        break;
      case 'pedido-pendente':
        this.mensagem.set({ titulo: 'Pedido já enviado', texto: `Falta o dono de ${r.grupo.nome} aceitar você.` });
        break;
      default:
        this.mensagem.set({ titulo: r.estado === 'inexistente' ? 'Convite inválido' : 'Não foi possível entrar', texto: r.mensagem });
    }
  }
}
