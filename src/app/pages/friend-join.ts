import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar } from '../core/avatar';
import { Perfil } from '../core/social';
import { SocialService } from '../core/social.service';
import { Carregando } from '../core/spinner';

/** Abre um link de amigo (`/amigo/:codigo`): mostra quem é e deixa pedir amizade. */
@Component({
  selector: 'app-friend-join',
  imports: [RouterLink, Avatar, Carregando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      @if (mensagem(); as m) {
        <div class="card bloco">
          <h1 class="sub">{{ m.titulo }}</h1>
          <p class="apoio">{{ m.texto }}</p>
          <a class="btn btn--escuro" routerLink="/social">Ir para o Social</a>
        </div>
      } @else if (perfil(); as p) {
        <div class="card bloco">
          <app-avatar [usuario]="{ uid: p.uid, nome: p.nome, email: '', foto: p.foto }" [tamanho]="72" />
          <h1 class="sub">{{ p.nome }}</h1>
          <p class="apoio">Quer ser seu amigo mais chegado? Vocês passam a ver a timeline um do outro, e as estatísticas que cada um deixar à mostra.</p>
          <button type="button" class="btn btn--escuro" [disabled]="enviando()" (click)="pedir()">{{ enviando() ? 'Enviando…' : 'Enviar pedido de amizade' }}</button>
        </div>
      } @else {
        <app-carregando texto="Abrindo convite…" />
      }
    </section>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: 16px; padding-top: 24px; }
    .bloco { padding: 20px; display: flex; flex-direction: column; gap: 14px; align-items: flex-start; }
    .sub { font-size: 22px; margin: 0; overflow-wrap: anywhere; }
    button:disabled { opacity: 0.6; }
  `,
})
export class FriendJoin {
  protected readonly social = inject(SocialService);

  /** Código da pessoa, vindo da rota (`/amigo/:codigo`). */
  readonly codigo = input.required<string>();

  protected readonly perfil = signal<Perfil | null>(null);
  protected readonly mensagem = signal<{ titulo: string; texto: string } | null>(null);
  protected readonly enviando = signal(false);
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
    const eu = this.social.eu();
    const p = await this.social.previaPorCodigo(this.codigo());
    if (!p) return this.mensagem.set({ titulo: 'Convite inválido', texto: this.social.erro() || 'Não encontramos ninguém com esse código. Confira o link com quem convidou.' });
    if (p.uid === eu?.uid) return this.mensagem.set({ titulo: 'Esse é o seu link', texto: 'Mande este link para quem você quer ter como amigo.' });
    const existente = this.social.amizadeCom(p.uid);
    if (existente?.status === 'aceita') return this.mensagem.set({ titulo: 'Vocês já são amigos', texto: `${p.nome} já está entre seus amigos mais chegados.` });
    this.perfil.set(p);
  }

  protected async pedir(): Promise<void> {
    const p = this.perfil();
    if (!p) return;
    this.enviando.set(true);
    const r = await this.social.pedirAmizade(p.uid);
    this.enviando.set(false);
    this.perfil.set(null);
    if ('mensagem' in r) this.mensagem.set({ titulo: 'Não foi possível', texto: r.mensagem });
    else if (r.estado === 'aceito') this.mensagem.set({ titulo: 'Agora vocês são amigos!', texto: `${r.perfil.nome} já tinha te pedido amizade.` });
    else if (r.estado === 'ja-amigos') this.mensagem.set({ titulo: 'Vocês já são amigos', texto: `${r.perfil.nome} já está entre seus amigos mais chegados.` });
    else this.mensagem.set({ titulo: 'Pedido enviado', texto: `Falta ${r.perfil.nome} aceitar. Quando aceitar, vocês passam a ver a timeline um do outro.` });
  }
}
