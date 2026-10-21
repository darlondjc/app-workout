import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { Avatar } from '../core/avatar';
import { Icon } from '../core/icon';
import { NavegacaoService } from '../core/navegacao.service';
import { Amizade } from '../core/social';
import { SocialService } from '../core/social.service';
import { Carregando } from '../core/spinner';

@Component({
  selector: 'app-friends',
  imports: [Avatar, Icon, Carregando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header>
        <button type="button" class="voltar" (click)="nav.voltar('/social')"><app-icon name="back" [size]="18" [stroke]="2.2" /> Voltar</button>
        <h1 class="titulo">Amigos</h1>
        <p class="apoio">Amigos veem seus treinos, estatísticas e recordes, e podem curtir e comentar. Você escolhe quem entra.</p>
      </header>

      @if (!social.ativo()) {
        @if (social.erro()) {
          <p class="erro" role="alert">{{ social.erro() }}</p>
        } @else {
          <app-carregando texto="Conectando…" />
        }
      } @else {
        <article class="card bloco" aria-labelledby="t-cod">
          <h2 id="t-cod" class="rot">Seu código</h2>
          <p class="codigo" aria-label="Seu código de amigo">{{ social.eu()?.codigo }}</p>
          <p class="apoio">Passe o código para quem você quer ter como amigo.</p>
          <div class="linha">
            <button type="button" class="btn btn--claro" [disabled]="copiado()" (click)="copiar()">{{ copiado() ? 'Copiado!' : 'Copiar' }}</button>
            @if (podeCompartilhar) {
              <button type="button" class="btn btn--escuro" (click)="compartilhar()">Compartilhar</button>
            }
          </div>
        </article>

        <article class="card bloco" aria-labelledby="t-add">
          <h2 id="t-add" class="rot">Adicionar amigo</h2>
          <form class="linha" (submit)="adicionar($event, campo)">
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

        @if (social.convitesRecebidos().length) {
          <section aria-labelledby="t-rec">
            <h2 id="t-rec" class="sub">Convites recebidos</h2>
            @for (p of social.convitesRecebidos(); track p.amizade.id) {
              <div class="card pessoa">
                <app-avatar [usuario]="{ uid: p.perfil.uid, nome: p.perfil.nome, email: '', foto: p.perfil.foto }" [tamanho]="44" />
                <strong class="nome">{{ p.perfil.nome }}</strong>
                <button type="button" class="btn btn--escuro mini" (click)="social.aceitar(p.amizade)">Aceitar</button>
                <button type="button" class="btn btn--claro mini" (click)="social.remover(p.amizade)">Recusar</button>
              </div>
            }
          </section>
        }

        <section aria-labelledby="t-amigos">
          <h2 id="t-amigos" class="sub">Seus amigos</h2>
          @for (p of social.amigos(); track p.perfil.uid) {
            <div class="card pessoa">
              <app-avatar [usuario]="{ uid: p.perfil.uid, nome: p.perfil.nome, email: '', foto: p.perfil.foto }" [tamanho]="44" />
              <strong class="nome">{{ p.perfil.nome }}</strong>
              @if (removendo() === p.amizade.id) {
                <button type="button" class="btn btn--escuro mini" (click)="confirmarRemocao(p.amizade)">Remover</button>
                <button type="button" class="btn btn--claro mini" (click)="removendo.set(null)">Não</button>
              } @else {
                <button type="button" class="btn btn--claro mini" (click)="removendo.set(p.amizade.id)">Desfazer</button>
              }
            </div>
          } @empty {
            <p class="apoio">Você ainda não tem amigos por aqui. Troque códigos para começar.</p>
          }
        </section>

        @if (social.convitesEnviados().length) {
          <section aria-labelledby="t-env">
            <h2 id="t-env" class="sub">Convites enviados</h2>
            @for (p of social.convitesEnviados(); track p.amizade.id) {
              <div class="card pessoa">
                <app-avatar [usuario]="{ uid: p.perfil.uid, nome: p.perfil.nome, email: '', foto: p.perfil.foto }" [tamanho]="44" />
                <strong class="nome">{{ p.perfil.nome }}</strong>
                <span class="apoio">aguardando</span>
                <button type="button" class="btn btn--claro mini" (click)="social.remover(p.amizade)">Cancelar</button>
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
    .linha { display: flex; gap: 8px; }
    .linha .btn { flex: 1; min-height: 48px; }
    form.linha .btn { flex: none; padding: 0 18px; }
    .campo { flex: 1; min-width: 0; min-height: 48px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--card); font: inherit; text-transform: uppercase; letter-spacing: 0.1em; }
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
  protected readonly removendo = signal<string | null>(null);
  protected readonly mensagem = signal<{ ok: boolean; texto: string } | null>(null);
  protected readonly podeCompartilhar = typeof navigator !== 'undefined' && !!navigator.share;

  constructor() {
    // O navegador não avisa quando a área de transferência muda. Então o botão volta quando a pessoa
    // copia outra coisa nesta página ou volta ao app (e, se der para ler, só se o conteúdo mudou).
    const aoCopiar = () => setTimeout(() => this.copiado.set(false));
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void this.liberarSeMudou();
    };
    document.addEventListener('copy', aoCopiar);
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', aoVoltar);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('copy', aoCopiar);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
    });
  }

  private async liberarSeMudou(): Promise<void> {
    if (!this.copiado()) return;
    try {
      const atual = await navigator.clipboard.readText();
      if (atual !== this.social.eu()?.codigo) this.copiado.set(false);
    } catch {
      // Sem permissão para ler: voltar ao app é o melhor sinal de que pode ter copiado outra coisa.
      this.copiado.set(false);
    }
  }

  protected async copiar(): Promise<void> {
    const c = this.social.eu()?.codigo;
    if (!c) return;
    try {
      await navigator.clipboard.writeText(c);
      this.copiado.set(true);
    } catch {
      this.mensagem.set({ ok: false, texto: 'Não deu para copiar. Selecione o código e copie manualmente.' });
    }
  }

  protected async compartilhar(): Promise<void> {
    const c = this.social.eu()?.codigo;
    if (!c) return;
    try {
      await navigator.share({ title: 'App Workout', text: `Me adicione no App Workout! Meu código de amigo é ${c}.`, url: location.origin + location.pathname.replace(/amigos\/?$/, '') });
    } catch {
      // compartilhamento cancelado
    }
  }

  protected async adicionar(ev: Event, campo: HTMLInputElement): Promise<void> {
    ev.preventDefault();
    if (!campo.value.trim()) return;
    this.enviando.set(true);
    const r = await this.social.adicionarPorCodigo(campo.value);
    this.enviando.set(false);
    this.mensagem.set({ ok: r.ok, texto: r.mensagem });
    if (r.ok) campo.value = '';
  }

  protected async confirmarRemocao(a: Amizade): Promise<void> {
    this.removendo.set(null);
    await this.social.remover(a);
  }
}
