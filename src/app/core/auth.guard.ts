import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CloudService } from './cloud.service';

/** Sem login, a porta de entrada do app é a tela de login; depois de entrar, a pessoa volta para onde queria ir (ex.: um convite). */
export const logado: CanActivateFn = async (_rota, estado) => {
  const nuvem = inject(CloudService);
  if (!nuvem.configurado) return true;
  void nuvem.iniciar();
  await nuvem.aguardarPronto();
  if (nuvem.usuario()) return true;
  const router = inject(Router);
  return estado.url === '/' ? router.parseUrl('/entrar') : router.createUrlTree(['/entrar'], { queryParams: { voltar: estado.url } });
};
