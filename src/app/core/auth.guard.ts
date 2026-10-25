import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CloudService } from './cloud.service';

/** Sem login, a porta de entrada do app é a tela de login; depois de entrar, a pessoa volta para onde queria ir (ex.: um convite). */
export const logado: CanActivateFn = async (_rota, estado) => {
  // O `inject` só vale antes do primeiro `await`: depois dele o contexto de injeção já se perdeu.
  const nuvem = inject(CloudService);
  const router = inject(Router);
  if (!nuvem.configurado) return true;
  void nuvem.iniciar();
  await nuvem.aguardarPronto();
  if (nuvem.usuario()) return true;
  return estado.url === '/' ? router.parseUrl('/entrar') : router.createUrlTree(['/entrar'], { queryParams: { voltar: estado.url } });
};
