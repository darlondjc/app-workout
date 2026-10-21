import { Component, computed, inject } from '@angular/core';
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
import { Icon } from './core/icon';
import { LoadingService } from './core/loading.service';
import { ToastService } from './core/toast.service';
import { UpdateService } from './core/update.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);
  protected readonly toast = inject(ToastService);
  protected readonly loading = inject(LoadingService);
  protected readonly update = inject(UpdateService);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  constructor() {
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

  /** Não interrompe o treino em andamento com o aviso de atualização. */
  protected readonly mostrarAviso = computed(() => !this.url().startsWith('/treino'));

  /** A barra de abas some nas telas de foco (detalhe do exercício e treino). */
  protected readonly mostrarAbas = computed(() => {
    const u = this.url();
    return !u.startsWith('/exercicio') && !u.startsWith('/treino');
  });
}
