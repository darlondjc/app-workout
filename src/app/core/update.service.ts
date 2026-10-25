import { Injectable, computed, inject, signal } from '@angular/core';
import { SwUpdate, VersionEvent } from '@angular/service-worker';

const CHAVE_DISPENSADA = 'app-workout:aviso-dispensado:v1';
const INTERVALO_MS = 30 * 60 * 1000;

export interface NovaVersao {
  versao: string;
  titulo: string;
  novidades: string[];
}

function lerDispensada(): string | null {
  try {
    return localStorage.getItem(CHAVE_DISPENSADA);
  } catch {
    return null;
  }
}

/** Detecta versões novas (service worker), avisa o usuário e aplica a atualização. */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  private readonly sw = inject(SwUpdate);

  /** Falso em desenvolvimento ou em navegador sem service worker. */
  readonly disponivel = this.sw.isEnabled;

  /** Versão nova já baixada e pronta para ativar. */
  readonly pronta = signal<NovaVersao | null>(null);
  readonly verificando = signal(false);
  readonly atualizando = signal(false);
  readonly falhou = signal(false);
  /** Resultado da última verificação manual: 'atual' = nada novo. */
  readonly ultimaVerificacao = signal<'atual' | 'nova' | 'erro' | null>(null);

  private readonly dispensada = signal<string | null>(lerDispensada());

  /** O botão suspenso só aparece enquanto o usuário não o dispensou para esta versão. */
  readonly mostrarBotao = computed(() => {
    const v = this.pronta();
    return !!v && v.versao !== this.dispensada() && !this.atualizando();
  });

  constructor() {
    if (!this.sw.isEnabled) return;

    this.sw.versionUpdates.subscribe((e: VersionEvent) => {
      if (e.type === 'VERSION_READY') {
        const d = (e.latestVersion.appData ?? {}) as Partial<NovaVersao>;
        this.pronta.set({
          versao: d.versao ?? 'nova',
          titulo: d.titulo ?? '',
          novidades: d.novidades ?? [],
        });
      } else if (e.type === 'VERSION_INSTALLATION_FAILED') {
        this.falhou.set(true);
      }
    });
    // Estado corrompido do cache: recarregar resolve.
    this.sw.unrecoverable.subscribe(() => document.location.reload());

    void this.verificar(false);
    setInterval(() => void this.verificar(false), INTERVALO_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.verificar(false);
    });
  }

  /** Procura versão nova. `manual` = pedido pelo usuário (guarda o resultado para mostrar na tela). */
  async verificar(manual = true): Promise<void> {
    if (!this.sw.isEnabled || this.verificando()) return;
    if (manual) {
      this.verificando.set(true);
      this.ultimaVerificacao.set(null);
    }
    try {
      const achou = await this.sw.checkForUpdate();
      if (manual) this.ultimaVerificacao.set(achou || this.pronta() ? 'nova' : 'atual');
    } catch {
      if (manual) this.ultimaVerificacao.set('erro');
    } finally {
      if (manual) this.verificando.set(false);
    }
  }

  /** Ativa a versão baixada e recarrega o app. */
  async atualizar(): Promise<void> {
    if (!this.sw.isEnabled || this.atualizando()) return;
    this.atualizando.set(true);
    try {
      await this.sw.activateUpdate();
    } catch {
      // Se a ativação falhar, o reload abaixo ainda pega a versão nova na próxima carga.
    }
    document.location.reload();
  }

  /** Fecha o botão suspenso; a atualização continua disponível no Perfil. */
  dispensar(): void {
    const v = this.pronta()?.versao;
    if (!v) return;
    this.dispensada.set(v);
    try {
      localStorage.setItem(CHAVE_DISPENSADA, v);
    } catch {
      // Sem armazenamento: vale só nesta sessão.
    }
  }
}
