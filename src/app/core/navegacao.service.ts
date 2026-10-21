import { Location } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

/**
 * "Voltar" de verdade: leva para a tela de onde a pessoa veio (ficha, treino, sugestão...).
 * Se o app foi aberto direto nesta tela, não há para onde voltar e usa o endereço de reserva.
 */
@Injectable({ providedIn: 'root' })
export class NavegacaoService {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private telas = 0;

  constructor() {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.telas++;
    });
  }

  voltar(reserva: string): void {
    if (this.telas > 1) this.location.back();
    else void this.router.navigateByUrl(reserva, { replaceUrl: true });
  }
}
