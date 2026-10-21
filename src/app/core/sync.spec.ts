import type { Sessao } from './models';
import type { EstadoNuvem } from './plan.service';
import { AlvoLocal, DocEstado, NuvemBackend, Sincronizador, StatusSync } from './sync';

class NuvemFalsa implements NuvemBackend {
  gravados: DocEstado[] = [];
  sessoesGravadas: Sessao[] = [];
  falharSessao = false;
  private cbEstado?: (doc: DocEstado | null, pendente: boolean) => void;
  private cbSessoes?: (s: Sessao[]) => void;

  ouvirEstado(_uid: string, cb: (doc: DocEstado | null, pendente: boolean) => void): () => void {
    this.cbEstado = cb;
    return () => undefined;
  }
  gravarEstado(_uid: string, doc: DocEstado): Promise<void> {
    this.gravados.push(doc);
    return Promise.resolve();
  }
  ouvirSessoes(_uid: string, cb: (s: Sessao[]) => void): () => void {
    this.cbSessoes = cb;
    return () => undefined;
  }
  gravarSessao(_uid: string, s: Sessao): Promise<void> {
    if (this.falharSessao) return Promise.reject(new Error('sem rede'));
    this.sessoesGravadas.push(s);
    return Promise.resolve();
  }
  aguardarGravacoes(): Promise<void> {
    return Promise.resolve();
  }

  receberEstado(doc: DocEstado | null, pendente = false): void {
    this.cbEstado?.(doc, pendente);
  }
  receberSessoes(l: Sessao[]): void {
    this.cbSessoes?.(l);
  }
}

class AlvoFalso implements AlvoLocal {
  estado: EstadoNuvem = { fichas: [], ativaId: null, emAndamento: null };
  sessoes: Sessao[] = [];
  aplicados: { estado: EstadoNuvem; mesclar: boolean }[] = [];

  lerEstado(): EstadoNuvem {
    return this.estado;
  }
  aplicarEstado(e: EstadoNuvem, mesclar: boolean): void {
    this.aplicados.push({ estado: e, mesclar });
    this.estado = e;
  }
  lerSessoes(): Sessao[] {
    return this.sessoes;
  }
  mesclarSessoes(s: Sessao[]): void {
    for (const x of s) if (!this.sessoes.some((y) => y.id === x.id)) this.sessoes.push(x);
  }
}

const ficha = (id: string) => ({ id, nome: `Ficha ${id}`, itens: [] });
const estadoCom = (...ids: string[]): EstadoNuvem => ({ fichas: ids.map(ficha), ativaId: null, emAndamento: null });
const sessao = (id: string): Sessao => ({ id, data: '2026-10-20', fichaId: 'f1', concluidaEm: 1 });

/** Temporizador falso: guarda o que foi agendado e só dispara quando o teste manda o tempo passar. */
interface Temporizador {
  fn: () => void;
  ms: number;
  desde: number;
  ativo: boolean;
}

/** Deixa as promessas pendentes terminarem. */
async function esvaziar(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('Sincronizador', () => {
  let nuvem: NuvemFalsa;
  let alvo: AlvoFalso;
  let status: StatusSync[];
  let sinc: Sincronizador;

  let temporizadores: Temporizador[];
  let relogio: number;

  /** Faz `ms` milissegundos passarem e dispara os temporizadores que venceram. */
  function avancar(ms: number): void {
    relogio += ms;
    for (const t of temporizadores) {
      if (t.ativo && relogio - t.desde >= t.ms) {
        t.ativo = false;
        t.fn();
      }
    }
  }

  beforeEach(() => {
    temporizadores = [];
    relogio = 0;
    spyOn(globalThis, 'setTimeout').and.callFake(((fn: () => void, ms = 0) => {
      const t: Temporizador = { fn, ms, desde: relogio, ativo: true };
      temporizadores.push(t);
      return t as unknown as ReturnType<typeof setTimeout>;
    }) as unknown as typeof setTimeout);
    spyOn(globalThis, 'clearTimeout').and.callFake(((t?: Temporizador) => {
      if (t) t.ativo = false;
    }) as unknown as typeof clearTimeout);
    nuvem = new NuvemFalsa();
    alvo = new AlvoFalso();
    status = [];
    sinc = new Sincronizador(nuvem, alvo, 'uid1', (s) => status.push(s), () => 123);
  });

  /** Primeiro contato sem nada na nuvem: o estado local sobe e a sincronização fica pronta. */
  async function iniciarSemNuvem(): Promise<void> {
    sinc.iniciar();
    nuvem.receberEstado(null);
    nuvem.receberSessoes([]);
    await esvaziar();
  }

  it('começa conectando', () => {
    sinc.iniciar();
    expect(status).toEqual(['conectando']);
  });

  describe('primeiro contato', () => {
    it('sem documento na nuvem, envia o estado do aparelho', async () => {
      alvo.estado = estadoCom('a');
      await iniciarSemNuvem();
      expect(nuvem.gravados.length).toBe(1);
      expect(nuvem.gravados[0].estado).toEqual(estadoCom('a'));
      expect(nuvem.gravados[0].atualizadoEm).toBe(123);
      expect(status.at(-1)).toBe('ok');
    });

    it('com documento na nuvem, mescla com o aparelho e não reenvia o que já é igual', async () => {
      sinc.iniciar();
      nuvem.receberEstado({ estado: estadoCom('a'), atualizadoEm: 1, origem: 'outro' });
      await esvaziar();
      expect(alvo.aplicados).toEqual([{ estado: estadoCom('a'), mesclar: true }]);
      expect(nuvem.gravados.length).toBe(0);
    });

    it('se a mesclagem muda o estado, devolve o resultado para a nuvem', async () => {
      sinc.iniciar();
      alvo.aplicarEstado = (e, mesclar) => {
        alvo.aplicados.push({ estado: e, mesclar });
        alvo.estado = estadoCom('a', 'local');
      };
      nuvem.receberEstado({ estado: estadoCom('a'), atualizadoEm: 1, origem: 'outro' });
      await esvaziar();
      expect(nuvem.gravados.length).toBe(1);
      expect(nuvem.gravados[0].estado).toEqual(estadoCom('a', 'local'));
    });

    it('ignora snapshots com gravação pendente', async () => {
      sinc.iniciar();
      nuvem.receberEstado({ estado: estadoCom('a'), atualizadoEm: 1, origem: 'outro' }, true);
      await esvaziar();
      expect(alvo.aplicados.length).toBe(0);
    });
  });

  describe('depois do primeiro contato', () => {
    beforeEach(iniciarSemNuvem);

    it('ignora o eco da própria gravação', async () => {
      alvo.estado = estadoCom('a');
      sinc.estadoMudou();
      avancar(1200);
      await esvaziar();
      const meu = nuvem.gravados.at(-1) as DocEstado;
      nuvem.receberEstado(meu);
      expect(alvo.aplicados.length).toBe(0);
    });

    it('aplica a mudança vinda de outro aparelho, sem mesclar', () => {
      nuvem.receberEstado({ estado: estadoCom('b'), atualizadoEm: 2, origem: 'outro-aparelho' });
      expect(alvo.aplicados).toEqual([{ estado: estadoCom('b'), mesclar: false }]);
    });

    it('agrupa várias mudanças locais em uma gravação só', async () => {
      const antes = nuvem.gravados.length; // a do primeiro contato
      alvo.estado = estadoCom('a');
      sinc.estadoMudou();
      alvo.estado = estadoCom('a', 'b');
      sinc.estadoMudou();
      avancar(1199);
      expect(nuvem.gravados.length).toBe(antes);
      avancar(1);
      await esvaziar();
      expect(nuvem.gravados.length).toBe(antes + 1);
      expect(nuvem.gravados.at(-1)?.estado).toEqual(estadoCom('a', 'b'));
    });

    it('mudança local ainda não enviada vence a que chega de fora', async () => {
      alvo.estado = estadoCom('local');
      sinc.estadoMudou();
      nuvem.receberEstado({ estado: estadoCom('remoto'), atualizadoEm: 2, origem: 'outro-aparelho' });
      expect(alvo.aplicados.length).toBe(0);
      avancar(1200);
      await esvaziar();
      expect(nuvem.gravados.at(-1)?.estado).toEqual(estadoCom('local'));
    });

    it('avisar mudança sem diferença real não grava nada', async () => {
      sinc.estadoMudou();
      avancar(5000);
      await esvaziar();
      expect(nuvem.gravados.length).toBe(1); // só a gravação do primeiro contato
    });

    it('descarregar envia o que está pendente sem esperar o atraso', async () => {
      alvo.estado = estadoCom('a');
      sinc.estadoMudou();
      await sinc.descarregar();
      expect(nuvem.gravados.at(-1)?.estado).toEqual(estadoCom('a'));
    });

    it('depois de parar, ignora o que chega e avisa "parado"', () => {
      sinc.parar();
      nuvem.receberEstado({ estado: estadoCom('x'), atualizadoEm: 3, origem: 'outro' });
      expect(alvo.aplicados.length).toBe(0);
      expect(status.at(-1)).toBe('parado');
    });
  });

  describe('sessões concluídas', () => {
    it('une as da nuvem com as do aparelho e envia só as que faltam', async () => {
      alvo.sessoes = [sessao('a'), sessao('b')];
      sinc.iniciar();
      nuvem.receberEstado(null);
      nuvem.receberSessoes([sessao('a'), sessao('c')]);
      await esvaziar();
      expect(alvo.sessoes.map((s) => s.id).sort()).toEqual(['a', 'b', 'c']);
      expect(nuvem.sessoesGravadas.map((s) => s.id)).toEqual(['b']);
    });

    it('não envia a mesma sessão duas vezes', async () => {
      alvo.sessoes = [sessao('b')];
      await iniciarSemNuvem();
      sinc.sessoesMudaram();
      sinc.sessoesMudaram();
      await esvaziar();
      expect(nuvem.sessoesGravadas.map((s) => s.id)).toEqual(['b']);
    });

    it('um treino novo é enviado quando o histórico muda', async () => {
      await iniciarSemNuvem();
      alvo.sessoes.push(sessao('nova'));
      sinc.sessoesMudaram();
      await esvaziar();
      expect(nuvem.sessoesGravadas.map((s) => s.id)).toEqual(['nova']);
    });

    it('se o envio falha, tenta de novo na próxima mudança', async () => {
      nuvem.falharSessao = true;
      alvo.sessoes = [sessao('x')];
      await iniciarSemNuvem();
      expect(status).toContain('erro');
      expect(nuvem.sessoesGravadas.length).toBe(0);

      nuvem.falharSessao = false;
      sinc.sessoesMudaram();
      await esvaziar();
      expect(nuvem.sessoesGravadas.map((s) => s.id)).toEqual(['x']);
    });

    it('sessão sem id não é enviada', async () => {
      alvo.sessoes = [{ data: '2026-10-20', fichaId: 'f1' }];
      await iniciarSemNuvem();
      expect(nuvem.sessoesGravadas.length).toBe(0);
    });
  });
});
