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

bootstrapApplication(App, appConfig)
  .then(() => requestAnimationFrame(() => setTimeout(esconderAbertura, 250)))
  .catch((err) => {
    console.error(err);
    esconderAbertura();
  });
