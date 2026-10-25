import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Avatar } from '../core/avatar';
import { Icon } from '../core/icon';
import { NavegacaoService } from '../core/navegacao.service';
import { linkDoAmigo } from '../core/social';
import { SocialService } from '../core/social.service';
import { Carregando } from '../core/spinner';
import { baseDoApp } from './group-invite';

/** Adicionar um amigo mais chegado (de um grupo ou de fora): seu link e código, e o campo para colar o de outra pessoa. */
@Component({
  selector: 'app-friends',
  imports: [Avatar, Icon, Carregando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header>
        <button type="button" class="voltar" (click)="nav.voltar('/social')"><app-icon name="back" [size]="18" [stroke]="2.2" /> Voltar</button>
        <h1 class="titulo">Amigos mais chegados</h1>
        <p class="apoio">Quem você aceita como amigo mais chegado vê sua timeline e as estatísticas que você deixar à mostra, como o gráfico de peso. Pode ser alguém dos seus grupos ou de fora.</p>
      </header>

      @if (!social.ativo()) {
        @if (social.erro()) {
          <p class="erro" role="alert">{{ social.erro() }}</p>
        } @else {
          <app-carregando texto="Conectando…" />
        }
      } @else {
        <article class="card bloco" aria-labelledby="t-meu">
          <h2 id="t-meu" class="rot">Seu link de amigo</h2>
          <p class="codigo" aria-label="Seu código de amigo">{{ social.eu()?.codigo }}</p>
          <div class="botoes">
            @if (podeCompartilhar) {
              <button type="button" class="btn btn--escuro" (click)="compartilhar()"><app-icon name="send" [size]="18" [stroke]="2" /> Compartilhar</button>
            }
            <button type="button" class="btn btn--claro" (click)="copiar()"><app-icon [name]="copiado() ? 'check' : 'link'" [size]="18" [stroke]="2" /> {{ copiado() ? 'Link copiado' : 'Copiar link' }}</button>
          </div>

          <div class="divisor" role="presentation"></div>

          <h2 id="t-add" class="rot">Adicionar pelo código</h2>
          <form class="form" (submit)="adicionar($event, campo)" aria-labelledby="t-add">
            <input #campo class="campo" type="text" autocapitalize="characters" autocomplete="off" maxlength="12" placeholder="Código do amigo" aria-label="Código do amigo" />
            <button type="submit" class="btn btn--escuro" [disabled]="enviando()">{{ enviando() ? '…' : 'Adicionar' }}</button>
          </form>
          @if (mensagem(); as m) {
            <p class="apoio" [class.erro]="!m.ok" role="status">{{ m.texto }}</p>
          }
        </article>

        @if (social.erro()) {
          <p class="erro" role="alert">{{ social.erro() }}</p>
        }

        @if (social.pedidosDeAmizade().length) {
          <section aria-labelledby="t-rec">
            <h2 id="t-rec" class="sub">Pedidos recebidos</h2>
            @for (p of social.pedidosDeAmizade(); track p.amizade.id) {
              <div class="card pessoa">
                <app-avatar [usuario]="{ uid: p.perfil.uid, nome: p.perfil.nome, email: '', foto: p.perfil.foto }" [tamanho]="44" />
                <strong class="nome">{{ p.perfil.nome }}</strong>
                <button type="button" class="btn btn--escuro mini" (click)="social.aceitarAmizade(p.amizade)">Aceitar</button>
                <button type="button" class="btn btn--claro mini" (click)="social.removerAmizade(p.amizade)">Recusar</button>
              </div>
            }
          </section>
        }

        @if (social.pedidosEnviados().length) {
          <section aria-labelledby="t-env">
            <h2 id="t-env" class="sub">Pedidos enviados</h2>
            @for (p of social.pedidosEnviados(); track p.amizade.id) {
              <div class="card pessoa">
                <app-avatar [usuario]="{ uid: p.perfil.uid, nome: p.perfil.nome, email: '', foto: p.perfil.foto }" [tamanho]="44" />
                <strong class="nome">{{ p.perfil.nome }}</strong>
                <span class="apoio">aguardando</span>
                <button type="button" class="btn btn--claro mini" (click)="social.removerAmizade(p.amizade)">Cancelar</button>
              </div>
            }
          </section>
        }
      }
    </section>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: 16px; }
    .voltar { border: 0; background: none; padding: 0; font: inherit; font-size: 14px; display: inline-flex; align-items: center; gap: 4px; min-height: 44px; color: var(--muted); }
    .bloco { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .rot { font-size: 15px; font-weight: 500; color: var(--muted); margin: 0; }
    .sub { font-size: 18px; margin: 0 0 8px; }
    .codigo { font-family: var(--font-display); font-size: 34px; font-weight: 700; letter-spacing: 0.12em; margin: 0; user-select: all; }
    .botoes { display: flex; gap: 8px; }
    .botoes .btn { flex: 1; min-height: 48px; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .divisor { height: 1px; background: var(--soft); margin: 4px 0; }
    .form { display: flex; gap: 8px; }
    .form .btn { flex: none; min-height: 48px; padding: 0 18px; }
    .campo { flex: 1; min-width: 0; min-height: 48px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--card); font: inherit; text-transform: uppercase; letter-spacing: 0.1em; }
    .campo::placeholder { letter-spacing: 0.03em; }
    .pessoa { padding: 12px 16px; display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .nome { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mini { min-height: 40px; padding: 0 14px; font-size: 14px; flex: none; }
    .erro { color: #b3261e; }
    button:disabled { opacity: 0.6; }
  `,
})
export class Friends {
  protected readonly social = inject(SocialService);
  protected readonly nav = inject(NavegacaoService);
  protected readonly copiado = signal(false);
  protected readonly enviando = signal(false);
  protected readonly mensagem = signal<{ ok: boolean; texto: string } | null>(null);
  protected readonly podeCompartilhar = typeof navigator !== 'undefined' && !!navigator.share;
  private readonly link = computed(() => linkDoAmigo(baseDoApp(), this.social.eu()?.codigo ?? ''));

  protected async compartilhar(): Promise<void> {
    try {
      await navigator.share({ title: 'App Workout', text: 'Me adicione como amigo no App Workout!', url: this.link() });
    } catch {
      // compartilhamento cancelado
    }
  }

  protected async copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.link());
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2500);
    } catch {
      this.mensagem.set({ ok: false, texto: 'Não deu para copiar. Passe o código acima para a pessoa.' });
    }
  }

  protected async adicionar(ev: Event, campo: HTMLInputElement): Promise<void> {
    ev.preventDefault();
    if (!campo.value.trim()) return;
    this.enviando.set(true);
    const r = await this.social.pedirAmizadePorCodigo(campo.value);
    this.enviando.set(false);
    const textos: Record<string, string> = {
      'pedido-enviado': 'Pedido enviado. Falta a pessoa aceitar.',
      'pedido-pendente': 'O pedido já foi enviado. Falta a pessoa aceitar.',
      'ja-amigos': 'Vocês já são amigos.',
      aceito: 'Essa pessoa já tinha te pedido. Agora vocês são amigos!',
    };
    const texto = 'mensagem' in r ? r.mensagem : `${r.perfil.nome}: ${textos[r.estado]}`;
    const ok = !('mensagem' in r);
    this.mensagem.set({ ok, texto });
    if (ok) campo.value = '';
  }
}
