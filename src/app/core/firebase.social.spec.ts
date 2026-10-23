import { FirebaseBackend } from './firebase.backend';
import { FirebaseSocial, idAvisoCurtida } from './firebase.social';
import { Perfil, TAMANHO_COMENTARIO } from './social';

interface Ref {
  caminho: string;
}

/** Firestore de mentira: guarda as gravações e as consultas montadas. */
function firestoreFalso() {
  const gravacoes: { caminho: string; dados: Record<string, unknown> }[] = [];
  const consultas: { ordem?: [string, string]; limite?: number }[] = [];
  const lidos: Record<string, Record<string, unknown>> = {};
  const atualizacoes: { caminho: string; dados: Record<string, unknown> }[] = [];
  const ref = (_db: unknown, ...partes: string[]): Ref => ({ caminho: partes.join('/') });
  const fs = {
    doc: ref,
    collection: ref,
    orderBy: (campo: string, direcao: string) => ({ ordem: [campo, direcao] as [string, string] }),
    limit: (n: number) => ({ limite: n }),
    query: (_base: Ref, ...restricoes: object[]) => {
      const c = Object.assign({}, ...restricoes) as { ordem?: [string, string]; limite?: number };
      consultas.push(c);
      return c;
    },
    setDoc: jasmine.createSpy('setDoc').and.callFake((r: Ref, dados: Record<string, unknown>) => {
      gravacoes.push({ caminho: r.caminho, dados });
      return Promise.resolve();
    }),
    deleteDoc: jasmine.createSpy('deleteDoc').and.returnValue(Promise.resolve()),
    getDoc: jasmine.createSpy('getDoc').and.callFake((r: Ref) => Promise.resolve({ exists: () => r.caminho in lidos, data: () => lidos[r.caminho] })),
    updateDoc: jasmine.createSpy('updateDoc').and.callFake((r: Ref, dados: Record<string, unknown>) => {
      atualizacoes.push({ caminho: r.caminho, dados });
      return Promise.resolve();
    }),
    onSnapshot: jasmine.createSpy('onSnapshot').and.returnValue(() => undefined),
  };
  return { fs, gravacoes, consultas, lidos, atualizacoes };
}

const eu: Perfil = { uid: 'eu', nome: 'Eu', foto: null };

function criar() {
  const falso = firestoreFalso();
  const social = new FirebaseSocial(falso.fs as unknown as ConstructorParameters<typeof FirebaseSocial>[0], {} as never);
  return { ...falso, social };
}

describe('FirebaseSocial', () => {
  describe('curtir', () => {
    it('registra a curtida e avisa o dono do treino', async () => {
      const { social, gravacoes } = criar();
      await social.curtir('dono', 'ev1', eu);
      expect(gravacoes.map((g) => g.caminho)).toEqual(['usuarios/dono/eventos/ev1/curtidas/eu', `usuarios/dono/atividades/curtida_ev1_eu`]);
      expect(gravacoes[1].dados['tipo']).toBe('curtida');
      expect(gravacoes[1].dados['autor']).toBe('eu');
    });

    it('curtir, descurtir e curtir de novo atualiza o mesmo aviso, sem empilhar', async () => {
      const { social, gravacoes } = criar();
      let agora = 1_800_000_000_000;
      spyOn(Date, 'now').and.callFake(() => (agora += 5_000)); // o tempo passa entre uma curtida e outra
      await social.curtir('dono', 'ev1', eu);
      await social.descurtir('dono', 'ev1', 'eu');
      await social.curtir('dono', 'ev1', eu);
      const avisos = gravacoes.filter((g) => g.caminho.includes('/atividades/')).map((g) => g.caminho);
      expect(avisos.length).toBe(2);
      expect(new Set(avisos).size).toBe(1);
    });

    it('avisos de pessoas ou treinos diferentes têm ids diferentes', () => {
      expect(idAvisoCurtida('ev1', 'ana')).not.toBe(idAvisoCurtida('ev1', 'bia'));
      expect(idAvisoCurtida('ev1', 'ana')).not.toBe(idAvisoCurtida('ev2', 'ana'));
    });

    it('o id do aviso cabe no limite do Firestore mesmo com ids longos', () => {
      expect(idAvisoCurtida('e'.repeat(300), 'u'.repeat(50)).length).toBe(200);
    });

    it('curtir o próprio treino não gera aviso', async () => {
      const { social, gravacoes } = criar();
      await social.curtir('eu', 'ev1', eu);
      expect(gravacoes.map((g) => g.caminho)).toEqual(['usuarios/eu/eventos/ev1/curtidas/eu']);
    });

    it('se só o aviso falha, a curtida vale e não há erro para a tela', async () => {
      const { social, fs, gravacoes } = criar();
      fs.setDoc.and.callFake((r: Ref, dados: Record<string, unknown>) => {
        if (r.caminho.includes('/atividades/')) return Promise.reject(new Error('permission-denied'));
        gravacoes.push({ caminho: r.caminho, dados });
        return Promise.resolve();
      });
      await expectAsync(social.curtir('dono', 'ev1', eu)).toBeResolved();
      expect(gravacoes.map((g) => g.caminho)).toEqual(['usuarios/dono/eventos/ev1/curtidas/eu']);
    });

    it('se a curtida em si falha, o erro chega a quem chamou', async () => {
      const { social, fs } = criar();
      fs.setDoc.and.callFake(() => Promise.reject(new Error('sem rede')));
      await expectAsync(social.curtir('dono', 'ev1', eu)).toBeRejected();
    });
  });

  describe('comentar', () => {
    it('grava o comentário e o aviso com o texto aparado', async () => {
      const { social, gravacoes } = criar();
      await social.comentar('dono', 'ev1', eu, '  boa!  ');
      expect(gravacoes.length).toBe(2);
      expect(gravacoes[0].caminho).toMatch(/^usuarios\/dono\/eventos\/ev1\/comentarios\/\d{13}_eu$/);
      expect(gravacoes[0].dados['texto']).toBe('boa!');
      expect(gravacoes[1].caminho).toContain('usuarios/dono/atividades/');
      expect(gravacoes[1].dados['texto']).toBe('boa!');
    });

    it('corta o texto no tamanho máximo', async () => {
      const { social, gravacoes } = criar();
      await social.comentar('dono', 'ev1', eu, 'x'.repeat(TAMANHO_COMENTARIO + 50));
      expect((gravacoes[0].dados['texto'] as string).length).toBe(TAMANHO_COMENTARIO);
    });

    it('comentário vazio não grava nada', async () => {
      const { social, gravacoes } = criar();
      await social.comentar('dono', 'ev1', eu, '   ');
      expect(gravacoes.length).toBe(0);
    });
  });

  describe('reações: falha ao ler', () => {
    /** Pega o callback de erro que foi entregue ao `onSnapshot`. */
    function erroEntregue(fs: ReturnType<typeof firestoreFalso>['fs']): (e: unknown) => void {
      return fs.onSnapshot.calls.mostRecent().args[2] as (e: unknown) => void;
    }

    it('curtidas: repassa o erro em vez de fingir que não há curtidas', () => {
      const { social, fs } = criar();
      const cb = jasmine.createSpy('cb');
      const erro = jasmine.createSpy('erro');
      social.ouvirCurtidas('dono', 'ev1', cb, erro);
      const falha = { code: 'permission-denied' };
      erroEntregue(fs)(falha);
      expect(erro).toHaveBeenCalledOnceWith(falha);
      expect(cb).not.toHaveBeenCalled();
    });

    it('comentários: repassa o erro em vez de fingir que não há comentários', () => {
      const { social, fs } = criar();
      const cb = jasmine.createSpy('cb');
      const erro = jasmine.createSpy('erro');
      social.ouvirComentarios('dono', 'ev1', cb, erro);
      const falha = { code: 'unavailable' };
      erroEntregue(fs)(falha);
      expect(erro).toHaveBeenCalledOnceWith(falha);
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('consultas', () => {
    it('as atividades vêm pela data, não pelo id (o aviso de curtida tem id fixo)', () => {
      const { social, consultas } = criar();
      social.ouvirAtividades('eu', () => undefined, () => undefined);
      expect(consultas).toEqual([{ ordem: ['criadoEm', 'desc'], limite: 30 }]);
    });
  });
});

describe('FirebaseBackend.ouvirSessoes', () => {
  function criarBackend() {
    const falso = firestoreFalso();
    const Backend = FirebaseBackend as unknown as new (m: unknown, auth: unknown, db: unknown) => FirebaseBackend;
    const backend = new Backend({ auth: {}, fs: falso.fs }, {}, {});
    return { ...falso, backend };
  }

  it('sem limite, lê o histórico inteiro (a sincronização das próprias sessões precisa dele)', () => {
    const { backend, consultas, fs } = criarBackend();
    backend.ouvirSessoes('eu', () => undefined, () => undefined);
    expect(consultas).toEqual([]);
    expect((fs.onSnapshot.calls.mostRecent().args[0] as Ref).caminho).toBe('usuarios/eu/sessoes');
  });

  it('com limite, lê só os treinos mais recentes', () => {
    const { backend, consultas } = criarBackend();
    backend.ouvirSessoes('ana', () => undefined, () => undefined, 400);
    expect(consultas).toEqual([{ ordem: ['data', 'desc'], limite: 400 }]);
  });
  describe('foto do treino', () => {
    it('grava a foto num documento próprio, fora do card, só com os dados e a hora', async () => {
      const { social, gravacoes } = criar();
      await social.gravarFoto('eu', 's1', 'data:image/jpeg;base64,AAA');
      expect(gravacoes.length).toBe(1);
      expect(gravacoes[0].caminho).toBe('usuarios/eu/fotos/s1');
      expect(Object.keys(gravacoes[0].dados).sort()).toEqual(['criadoEm', 'dados']);
      expect(gravacoes[0].dados['dados']).toBe('data:image/jpeg;base64,AAA');
    });

    it('lê a foto do documento; sem documento, ou com dado estranho, devolve null', async () => {
      const { social, lidos } = criar();
      lidos['usuarios/ana/fotos/s1'] = { dados: 'data:image/jpeg;base64,BBB' };
      lidos['usuarios/ana/fotos/s2'] = { dados: 42 };
      expect(await social.lerFoto('ana', 's1')).toBe('data:image/jpeg;base64,BBB');
      expect(await social.lerFoto('ana', 's2')).toBeNull();
      expect(await social.lerFoto('ana', 'nao-existe')).toBeNull();
    });

    it('apagar remove o documento e o aviso é ligado ou desligado só no campo temFoto do card', async () => {
      const { social, fs, atualizacoes } = criar();
      await social.apagarFoto('eu', 's1');
      expect(fs.deleteDoc).toHaveBeenCalledWith({ caminho: 'usuarios/eu/fotos/s1' });
      await social.marcarFotoEvento('eu', 'ev1', true);
      await social.marcarFotoEvento('eu', 'ev1', false);
      expect(atualizacoes).toEqual([
        { caminho: 'usuarios/eu/eventos/ev1', dados: { temFoto: true } },
        { caminho: 'usuarios/eu/eventos/ev1', dados: { temFoto: false } },
      ]);
    });
  });
});
