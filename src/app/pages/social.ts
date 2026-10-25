import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Avatar } from '../core/avatar';
import { BarraTopo } from '../core/barra-topo';
import { CloudService } from '../core/cloud.service';
import { Icon } from '../core/icon';
import { TAMANHO_NOME_GRUPO } from '../core/social';
import { SocialService } from '../core/social.service';
import { Carregando } from '../core/spinner';

/** Aba Social: os grupos de que a pessoa faz parte. A timeline e o convite ficam na tela de cada grupo. */
@Component({
  selector: 'app-social',
  imports: [RouterLink, Avatar, BarraTopo, Icon, Carregando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-barra-topo titulo="Grupos">
        <button type="button" class="novo novo--barra" aria-label="Criar grupo" (click)="criando.set(true)">
          <app-icon name="plus" [size]="20" [stroke]="2.4" />
        </button>
      </app-barra-topo>
      <header class="cabeca">
        <div>
          <p class="apoio">Treine junto</p>
          <h1 class="titulo">Grupos</h1>
        </div>
        <button type="button" class="novo" aria-label="Criar grupo" (click)="criando.set(true)">
          <app-icon name="plus" [size]="22" [stroke]="2.4" />
        </button>
      </header>

      @if (!cloud.configurado) {
        <p class="apoio">A parte social precisa do login. Ela fica disponível quando a conta estiver configurada.</p>
      } @else if (!social.ativo()) {
        @if (social.erro()) {
          <p class="erro" role="alert">{{ social.erro() }}</p>
        } @else {
          <app-carregando texto="Conectando…" />
        }
      } @else {
        @if (social.erro()) {
          <p class="erro" role="alert">{{ social.erro() }}</p>
        }

        @if (criando()) {
          <form class="card criar" (submit)="criar($event, campo)" aria-label="Novo grupo">
            <label class="rot" for="nome-grupo">Nome do grupo</label>
            <input #campo id="nome-grupo" class="campo" type="text" autocomplete="off" [attr.maxlength]="limiteNome" placeholder="Ex.: Grupo do Trabalho" />
            <div class="linha">
              <button type="button" class="btn btn--claro" (click)="criando.set(false)">Cancelar</button>
              <button type="submit" class="btn btn--escuro" [disabled]="salvando()">{{ salvando() ? 'Criando…' : 'Criar grupo' }}</button>
            </div>
          </form>
        }

        @if (social.pedidosRecebidos().length) {
          <section aria-labelledby="t-ped">
            <h2 id="t-ped" class="sub">Pedidos para entrar</h2>
            @for (p of social.pedidosRecebidos(); track p.grupo.id + p.perfil.uid) {
              <div class="card pedido">
                <app-avatar [usuario]="{ uid: p.perfil.uid, nome: p.perfil.nome, email: '', foto: p.perfil.foto }" [tamanho]="40" />
                <p class="texto"><strong>{{ p.perfil.nome }}</strong><span class="apoio">quer entrar em {{ p.grupo.nome }}</span></p>
                <button type="button" class="btn btn--escuro mini" (click)="social.responderPedido(p.grupo, p.perfil.uid, true)">Aceitar</button>
                <button type="button" class="btn btn--claro mini" (click)="social.responderPedido(p.grupo, p.perfil.uid, false)">Recusar</button>
              </div>
            }
          </section>
        }

        @for (g of social.gruposOrdenados(); track g.id) {
          <a class="card grupo" [routerLink]="['/grupo', g.id]">
            <div class="grupo__topo">
              <strong class="grupo__nome">{{ g.nome }}</strong>
              <span class="apoio">{{ g.membros.length }} {{ g.membros.length === 1 ? 'pessoa' : 'pessoas' }}</span>
            </div>
            <div class="grupo__pessoas">
              @for (m of social.membrosDe(g).slice(0, 6); track m.uid) {
                <app-avatar [usuario]="{ uid: m.uid, nome: m.nome, email: '', foto: m.foto }" [tamanho]="32" />
              }
              @if (g.membros.length > 6) {
                <span class="mais">+{{ g.membros.length - 6 }}</span>
              }
            </div>
            <app-icon class="seta" name="chevron" [size]="20" [stroke]="2.2" />
          </a>
        } @empty {
          @if (social.gruposCarregados()) {
            <div class="card vazio">
              <h2 class="sub">Você ainda não está em nenhum grupo</h2>
              <p class="apoio">Crie um grupo e convide amigos por link para ver os treinos uns dos outros, com curtidas e comentários. Se alguém mandou um link de convite, é só abri-lo.</p>
              <button type="button" class="btn btn--escuro" (click)="criando.set(true)">Criar grupo</button>
            </div>
          } @else {
            <app-carregando texto="Carregando grupos…" />
          }
        }
      }
    </section>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: 12px; }
    .cabeca { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .novo { position: relative; width: 44px; height: 44px; border: 0; border-radius: 50%; background: var(--ink); color: #fff; display: flex; align-items: center; justify-content: center; flex: none; }
    .novo--barra { width: 40px; height: 40px; }
    .sub { font-size: 18px; margin: 0 0 8px; }
    .rot { font-size: 15px; font-weight: 500; color: var(--muted); }
    .criar { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .campo { min-height: 48px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--card); font: inherit; }
    .linha { display: flex; gap: 8px; }
    .linha .btn { flex: 1; min-height: 48px; }
    .grupo { position: relative; padding: 14px 40px 14px 16px; display: flex; flex-direction: column; gap: 10px; color: inherit; text-decoration: none; }
    .grupo__topo { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    .grupo__nome { font-size: 17px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .grupo__pessoas { display: flex; align-items: center; }
    .grupo__pessoas app-avatar { margin-right: -8px; box-shadow: 0 0 0 2px var(--card); }
    .mais { margin-left: 14px; font-size: 13px; color: var(--muted); }
    .seta { position: absolute; right: 12px; top: 50%; margin-top: -10px; color: var(--muted); }
    .pedido { padding: 10px 12px; display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .texto { flex: 1; min-width: 0; margin: 0; display: flex; flex-direction: column; font-size: 14px; }
    .mini { min-height: 40px; padding: 0 12px; font-size: 14px; flex: none; }
    .vazio { padding: 20px; display: flex; flex-direction: column; gap: 12px; }
    .erro { color: #b3261e; font-size: 14px; }
    button:disabled { opacity: 0.6; }
  `,
})
export class Social {
  protected readonly cloud = inject(CloudService);
  protected readonly social = inject(SocialService);
  private readonly router = inject(Router);
  protected readonly criando = signal(false);
  protected readonly salvando = signal(false);
  protected readonly limiteNome = TAMANHO_NOME_GRUPO;

  protected async criar(ev: Event, campo: HTMLInputElement): Promise<void> {
    ev.preventDefault();
    if (!campo.value.trim() || this.salvando()) return;
    this.salvando.set(true);
    const g = await this.social.criarGrupo(campo.value);
    this.salvando.set(false);
    if (g) {
      this.criando.set(false);
      void this.router.navigate(['/grupo', g.id, 'convidar']);
    }
  }
}
