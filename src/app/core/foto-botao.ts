import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { LADO_FOTO_PERFIL, LIMITE_FOTO_PERFIL, reduzirFoto } from './foto';
import { CameraFoto } from './camera-foto';
import { Icon } from './icon';

/**
 * Botão que abre a câmera do app (ou a galeria, se o aparelho não deixar usar a câmera daqui), reduz a foto
 * e entrega o JPEG pequeno em data URL.
 */
@Component({
  selector: 'app-foto-botao',
  imports: [Icon, CameraFoto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.so-icone]': 'somenteIcone()' },
  template: `
    <input #arquivo type="file" accept="image/*" hidden (change)="aoEscolher(arquivo)" />
    <button type="button" [class]="classe()" [disabled]="preparando()" [attr.aria-label]="somenteIcone() ? rotulo() : null" (click)="abrir(arquivo)">
      <app-icon name="camera" [size]="somenteIcone() ? 20 : 18" [stroke]="2.2" />
      @if (!somenteIcone()) {
        {{ preparando() ? 'Preparando a foto…' : rotulo() }}
      }
    </button>
    @if (erro() && !somenteIcone()) {
      <p class="erro" role="alert">{{ erro() }}</p>
    }
    @if (camera()) {
      <app-camera-foto (tirada)="aoTirar($event)" (galeria)="camera.set(false); arquivo.click()" (fechar)="camera.set(false)" />
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 6px; }
    button { width: 100%; }
    /* Só o ícone: o botão entra direto numa linha de ações. */
    :host(.so-icone) { display: contents; }
    :host(.so-icone) button { width: auto; }
    .erro { margin: 0; font-size: 13px; color: var(--perigo); }
  `,
})
export class FotoBotao {
  readonly rotulo = input('Adicionar foto');
  readonly classe = input('btn btn--claro');
  /** Mostra só o ícone (o texto vira o nome acessível); o erro sai por `falhou`. */
  readonly somenteIcone = input(false);
  /** Foto de perfil: recorte quadrado pequeno, em vez de uma foto de treino. */
  readonly perfil = input(false);
  readonly escolhida = output<string>();
  readonly falhou = output<string>();

  protected readonly preparando = signal(false);
  protected readonly camera = signal(false);
  protected readonly erro = signal('');

  /** Abre a câmera do app; sem suporte a ela, cai no seletor do aparelho. */
  protected abrir(arquivo: HTMLInputElement): void {
    if (typeof navigator.mediaDevices?.getUserMedia === 'function') this.camera.set(true);
    else arquivo.click();
  }

  protected aoEscolher(campo: HTMLInputElement): Promise<void> {
    const arquivo = campo.files?.[0];
    campo.value = ''; // permite escolher a mesma foto de novo
    return arquivo ? this.processar(arquivo) : Promise.resolve();
  }

  protected aoTirar(foto: Blob): Promise<void> {
    this.camera.set(false);
    return this.processar(foto);
  }

  private async processar(arquivo: Blob): Promise<void> {
    this.erro.set('');
    this.preparando.set(true);
    try {
      this.escolhida.emit(
        this.perfil() ? await reduzirFoto(arquivo, LIMITE_FOTO_PERFIL, LADO_FOTO_PERFIL, true) : await reduzirFoto(arquivo),
      );
    } catch {
      this.erro.set('Não consegui usar essa foto. Tente outra.');
      this.falhou.emit(this.erro());
    } finally {
      this.preparando.set(false);
    }
  }
}
