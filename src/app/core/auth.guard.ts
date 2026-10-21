import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CloudService } from './cloud.service';

/** Sem login, a porta de entrada do app é a tela de login. */
export const logado: CanActivateFn = async () => {
  const nuvem = inject(CloudService);
  if (!nuvem.configurado) return true;
  void nuvem.iniciar();
  await nuvem.aguardarPronto();
  return nuvem.usuario() ? true : inject(Router).parseUrl('/entrar');
};
