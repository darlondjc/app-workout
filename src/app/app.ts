import { Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { Avatar } from './core/avatar';
import { CloudService } from './core/cloud.service';
import { Icon } from './core/icon';
import { NavegacaoService } from './core/navegacao.service';
import { SocialService } from './core/social.service';
import { LoadingService } from './core/loading.service';
import { PrecargaService } from './core/precarga.service';
import { ToastService } from './core/toast.service';
import { UpdateService } from './core/update.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Avatar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);
  protected readonly toast = inject(ToastService);
  protected readonly loading = inject(LoadingService);
  protected readonly update = inject(UpdateService);
  protected readonly nuvem = inject(CloudService);
  protected readonly social = inject(SocialService); // acompanha a timeline desde o início, para avisar na aba Social
  private readonly navegacao = inject(NavegacaoService); // começa a contar as telas desde a primeira
  private readonly precarga = inject(PrecargaService); // guarda as imagens das fichas para treinar sem internet

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  constructor() {
    // Segurar um link, imagem ou botão abriria o menu do navegador ("abrir em nova aba"...); aqui é um app.
    document.addEventListener('contextmenu', (e) => {
      const alvo = e.target as Element | null;
      if (alvo?.closest?.('a, img, button, svg') && !alvo.closest('input, textarea, [contenteditable]')) e.preventDefault();
    });
    // Quando a internet volta, avisa que o que ficou guardado no aparelho está sendo enviado.
    let estavaOffline = !this.nuvem.online();
    effect(() => {
      const online = this.nuvem.online();
      untracked(() => {
        if (online && estavaOffline) this.toast.mostrar('Conexão de volta. Sincronizando seus dados…');
        estavaOffline = !online;
      });
    });
    // Se a sessão terminar (ou sair da conta), volta para a tela de login. Na abertura do app quem manda para o login é o
    // guard da rota, que guarda para onde a pessoa queria ir (um convite, por exemplo); por isso espera a primeira navegação.
    effect(() => {
      if (this.nuvem.configurado && this.nuvem.pronto() && !this.nuvem.usuario() && this.router.navigated && !this.url().startsWith('/entrar')) {
        void this.router.navigateByUrl('/entrar', { replaceUrl: true });
      }
    });
    // Trocar de tela pode baixar o código da página (carregamento sob demanda).
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) this.loading.iniciar();
      else if (
        e instanceof NavigationEnd ||
        e instanceof NavigationCancel ||
        e instanceof NavigationError
      ) {
        this.loading.concluir();
      }
    });
  }

  /** Faixa "sem conexão": o treino continua funcionando e o que for feito sincroniza ao voltar. */
  protected readonly mostrarOffline = computed(() => !this.nuvem.online() && !this.url().startsWith('/entrar'));

  /** Não interrompe o treino em andamento com o aviso de atualização. */
  protected readonly mostrarAviso = computed(() => !this.url().startsWith('/treino') && !this.url().startsWith('/entrar'));

  /** A barra de abas some nas telas de foco (detalhe do exercício e treino). */
  protected readonly mostrarAbas = computed(() => {
    const u = this.url();
    return !u.startsWith('/exercicio') && !u.startsWith('/treino') && !u.startsWith('/entrar');
  });
}
