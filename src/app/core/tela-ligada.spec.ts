import { TestBed } from '@angular/core/testing';
import { TelaLigada } from './tela-ligada';

interface Falso {
  pedidos: number;
  liberados: number;
  sentinela: { released: boolean; release: () => Promise<void> };
}

/** Troca `navigator.wakeLock` por um falso que conta pedidos e liberações. */
function instalarWakeLock(recusar = false): Falso {
  const estado: Falso = {
    pedidos: 0,
    liberados: 0,
    sentinela: {
      released: false,
      release: () => {
        estado.liberados++;
        estado.sentinela.released = true;
        return Promise.resolve();
      },
    },
  };
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: {
      request: () => {
        estado.pedidos++;
        if (recusar) return Promise.reject(new DOMException('recusado', 'NotAllowedError'));
        // Cada pedido devolve um bloqueio novo, como o navegador faz.
        estado.sentinela = { released: false, release: estado.sentinela.release };
        return Promise.resolve(estado.sentinela as unknown as WakeLockSentinel);
      },
    },
  });
  return estado;
}

const esperar = () => new Promise<void>((r) => setTimeout(r, 0));

describe('TelaLigada', () => {
  let tela: TelaLigada;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    tela = TestBed.inject(TelaLigada);
  });

  afterEach(() => {
    tela.desligar();
    // @ts-expect-error remove o falso instalado pelo teste
    delete navigator.wakeLock;
  });

  it('pede a tela acesa uma vez, mesmo ligando duas vezes', async () => {
    const w = instalarWakeLock();
    tela.ligar();
    tela.ligar();
    await esperar();
    expect(w.pedidos).toBe(1);
  });

  it('desligar solta o bloqueio', async () => {
    const w = instalarWakeLock();
    tela.ligar();
    await esperar();
    tela.desligar();
    expect(w.liberados).toBe(1);
  });

  it('o navegador solta o bloqueio ao ir para segundo plano: ao voltar, pede de novo', async () => {
    const w = instalarWakeLock();
    tela.ligar();
    await esperar();
    w.sentinela.released = true;
    document.dispatchEvent(new Event('visibilitychange'));
    await esperar();
    expect(w.pedidos).toBe(2);
  });

  it('depois de desligar, voltar para o app não pede mais', async () => {
    const w = instalarWakeLock();
    tela.ligar();
    await esperar();
    tela.desligar();
    w.sentinela.released = true;
    document.dispatchEvent(new Event('visibilitychange'));
    await esperar();
    expect(w.pedidos).toBe(1);
  });

  it('se saiu do treino antes de o navegador responder, solta o bloqueio que chegou', async () => {
    const w = instalarWakeLock();
    tela.ligar();
    tela.desligar();
    await esperar();
    expect(w.pedidos).toBe(1);
    expect(w.liberados).toBe(1);
  });

  it('recusa do sistema não gera erro', async () => {
    const w = instalarWakeLock(true);
    tela.ligar();
    await esperar();
    expect(w.pedidos).toBe(1);
  });

  it('com a API indisponível, não lança erro', async () => {
    // @ts-expect-error garante que a API não existe
    delete navigator.wakeLock;
    expect(() => tela.ligar()).not.toThrow();
    await esperar();
  });
});
