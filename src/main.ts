import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/** Tira a abertura do index.html com um fade, depois que o app já está na tela. */
function esconderAbertura(): void {
  const el = document.getElementById('splash');
  if (!el) return;
  el.classList.add('saindo');
  setTimeout(() => el.remove(), 500);
}

// Trava em retrato onde o navegador permite (Android com o app instalado); nos demais, vale o aviso do CSS.
const orientacao = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
orientacao?.lock?.('portrait')?.catch(() => undefined);

bootstrapApplication(App, appConfig)
  .then(() => requestAnimationFrame(() => setTimeout(esconderAbertura, 250)))
  .catch((err) => {
    console.error(err);
    esconderAbertura();
  });
