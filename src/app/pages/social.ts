import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Avatar } from '../core/avatar';
import { AvatarGrupo } from '../core/avatar-grupo';
import { BarraTopo } from '../core/barra-topo';
import { CloudService } from '../core/cloud.service';
import { Icon } from '../core/icon';
import { TAMANHO_NOME_GRUPO, tempoRelativo } from '../core/social';
import { SocialService } from '../core/social.service';
import { Carregando } from '../core/spinner';

/** Aba Social: os grupos de que a pessoa faz parte e os amigos mais chegados. A timeline e o convite ficam na tela de cada grupo. */
@Component({
  selector: 'app-social',
  imports: [RouterLink, Avatar, AvatarGrupo, BarraTopo, Icon, Carregando],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-barra-topo titulo="Social" />
      <header class="cabeca">
        <div>
          <p class="apoio">Treine junto</p>
          <h1 class="titulo">Social</h1>
        </div>
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

        <div class="secao-topo">
          <h2 class="secao">Grupos</h2>
          <button type="button" class="novo" aria-label="Criar grupo" (click)="criando.set(true)">
            <app-icon name="plus" [size]="20" [stroke]="2.4" />
          </button>
        </div>

        @if (criando()) {
          <form class="card criar" (submit)="criar($event, campo)" aria-label="Novo grupo">
            <label class="rot" for="nome-grupo">Nome do grupo</label>
            <input #campo id="nome-grupo" class="campo" type="text" autocomplete="off" [attr.maxlength]="limiteNome" placeholder="Ex.: Grupo do Trabalho" />
            <div class="botoes">
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
          <a class="gc card" [routerLink]="['/grupo', g.id]" [attr.aria-label]="'Abrir ' + g.nome">
            <div class="gc__topo">
              <app-avatar-grupo [nome]="g.nome" [foto]="g.foto" [tamanho]="48" />
              <div class="gc__titulo">
                <strong class="gc__nome">{{ g.nome }}</strong>
                <span class="gc__meta">
                  {{ g.membros.length }} {{ g.membros.length === 1 ? 'pessoa' : 'pessoas' }} · {{ g.acesso === 'aberto' ? 'Aberto' : 'Com aprovação' }}
                </span>
              </div>
              @if (social.novosMembrosDe(g.id); as n) {
                <span class="gc__novo" role="status">{{ n }} {{ n === 1 ? 'nova pessoa' : 'novas pessoas' }}</span>
              }
              <app-icon class="gc__seta" name="chevron" [size]="20" [stroke]="2.2" />
            </div>
            <div class="gc__rodape">
              <div class="gc__pessoas">
                @for (m of social.membrosDe(g).slice(0, 5); track m.uid) {
                  <app-avatar [usuario]="{ uid: m.uid, nome: m.nome, email: '', foto: m.foto }" [tamanho]="30" />
                }
                @if (g.membros.length > 5) {
                  <span class="gc__mais">+{{ g.membros.length - 5 }}</span>
                }
              </div>
              <span class="gc__ultima">{{ ultima(g.id) }}</span>
            </div>
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

        <div class="secao-topo secao-topo--amigos">
          <h2 class="secao">Amigos mais chegados</h2>
          <a class="novo" routerLink="/amigos" aria-label="Adicionar amigo">
            <app-icon name="user-add" [size]="20" [stroke]="2" />
          </a>
        </div>

        @for (p of social.pedidosDeAmizade(); track p.amizade.id) {
          <div class="card pedido">
            <app-avatar [usuario]="{ uid: p.perfil.uid, nome: p.perfil.nome, email: '', foto: p.perfil.foto }" [tamanho]="40" />
            <p class="texto"><strong>{{ p.perfil.nome }}</strong><span class="apoio">quer ser seu amigo</span></p>
            <button type="button" class="btn btn--escuro mini" (click)="social.aceitarAmizade(p.amizade)">Aceitar</button>
            <button type="button" class="btn btn--claro mini" (click)="social.removerAmizade(p.amizade)">Recusar</button>
          </div>
        }

        @if (social.amigos().length) {
          <div class="card amigos">
            @for (a of social.amigos(); track a.uid) {
              <a class="amigo" [routerLink]="['/membro', a.uid]" [attr.aria-label]="'Abrir ' + a.nome">
                <app-avatar [usuario]="{ uid: a.uid, nome: a.nome, email: '', foto: a.foto }" [tamanho]="44" />
                <span class="amigo__txt">
                  <strong class="amigo__nome">{{ a.nome }}</strong>
                  <span class="amigo__meta">{{ ultimoTreino(a.uid) }}</span>
                </span>
                <app-icon class="amigo__seta" name="chevron" [size]="18" [stroke]="2.2" />
              </a>
            }
          </div>
        } @else if (!social.pedidosDeAmizade().length) {
          <div class="card vazio">
            <p class="apoio">Amigos mais chegados veem seus treinos e as estatísticas que você deixar. Pode ser alguém dos seus grupos ou de fora.</p>
            <a class="btn btn--claro" routerLink="/amigos">Adicionar amigo</a>
          </div>
        }
      }
    </section>
  `,
  styles: `
    .page { display: flex; flex-direction: column; gap: 12px; }
    .cabeca { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .secao-topo { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 4px; }
    .secao-topo--amigos { margin-top: 14px; }
    .secao { margin: 0; font-size: 20px; }
    .novo { position: relative; width: 40px; height: 40px; border: 0; border-radius: 50%; background: var(--ink); color: #fff; display: flex; align-items: center; justify-content: center; flex: none; }
    .sub { font-size: 18px; margin: 0 0 8px; }
    .rot { font-size: 15px; font-weight: 500; color: var(--muted); }
    .criar { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .campo { min-height: 48px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--card); font: inherit; }
    .botoes { display: flex; gap: 8px; }
    .botoes .btn { flex: 1; min-height: 48px; }
    .gc { display: flex; flex-direction: column; gap: 14px; padding: 16px; color: inherit; text-decoration: none; border: 1px solid var(--soft); box-shadow: 0 1px 2px rgb(20 23 26 / 5%), 0 6px 16px -10px rgb(20 23 26 / 18%); }
    .gc:active { transform: scale(0.99); }
    .gc__topo { display: flex; align-items: center; gap: 14px; }
    .gc__titulo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .gc__nome { font-family: var(--font-display); font-size: 18px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .gc__meta { font-size: 13px; color: var(--muted); }
    .gc__novo { flex: none; padding: 3px 9px; border-radius: 999px; background: var(--accent); color: var(--ink); font-size: 12px; font-weight: 700; }
    .gc__seta { flex: none; color: var(--muted); }
    .gc__rodape { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 12px; border-top: 1px solid var(--soft); }
    .gc__pessoas { display: flex; align-items: center; flex: none; }
    .gc__pessoas app-avatar { margin-left: -8px; box-shadow: 0 0 0 2px var(--card); }
    .gc__pessoas app-avatar:first-child { margin-left: 0; }
    .gc__mais { margin-left: 8px; font-size: 13px; color: var(--muted); }
    .gc__ultima { min-width: 0; font-size: 13px; color: var(--muted); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .amigos { padding: 4px 0; }
    .amigo { display: flex; align-items: center; gap: 12px; padding: 10px 16px; color: inherit; text-decoration: none; }
    .amigo + .amigo { border-top: 1px solid var(--soft); }
    .amigo__txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .amigo__nome { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .amigo__meta { font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .amigo__seta { flex: none; color: var(--muted); }
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

  /** Resumo do treino mais recente de alguém do grupo, para o rodapé do card. */
  protected ultima(grupoId: string): string {
    const item = this.social.timelineDe(grupoId).find((i) => i.tipo === 'evento');
    if (!item || item.tipo !== 'evento') return 'Sem treinos ainda';
    const e = item.evento;
    const quem = e.autor === this.social.eu()?.uid ? 'Você' : this.social.nomeDe(e.autor, e.autorNome).split(/\s+/)[0];
    return `Último treino: ${quem} · ${tempoRelativo(item.criadoEm, Date.now())}`;
  }

  /** Quando foi o treino mais recente de um amigo (que o app já leu). */
  protected ultimoTreino(uid: string): string {
    const item = this.social.timelineDePessoa(uid).find((i) => i.tipo === 'evento');
    return item ? `Último treino · ${tempoRelativo(item.criadoEm, Date.now())}` : 'Sem treinos ainda';
  }

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
