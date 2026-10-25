import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CloudService } from './cloud.service';
import { ExerciseService } from './exercise.service';
import { Sessao } from './models';
import { MedalhasService } from './medalhas.service';
import { PlanService } from './plan.service';
import { Atividade, Comentario, Conexao, Evento, Grupo, Perfil, SocialBackend, chaveConexao, fotoParaItens } from './social';
import { LIMITE_SESSOES_MEMBRO, PAGINA_TIMELINE, SocialService } from './social.service';
import { NuvemBackend } from './sync';

interface Ouvinte<T> {
  cb: (dados: T) => void;
  erro: (e: unknown) => void;
  cancelado: boolean;
  limite?: number;
}

function ouvinte<T>(cb: (d: T) => void, erro: (e: unknown) => void, limite?: number): Ouvinte<T> {
  return { cb, erro, cancelado: false, limite };
}

/** Backend social de mentira: guarda cada ouvinte aberto e deixa o teste disparar dados e erros. */
class ApiFalsa implements SocialBackend {
  grupos?: Ouvinte<Grupo[]>;
  conexoes?: Ouvinte<Conexao[]>;
  eventos = new Map<string, Ouvinte<Evento[]>>();
  perfis: Record<string, Perfil> = {};

  lerPerfil = (uid: string) => Promise.resolve(this.perfis[uid] ?? null);
  gravados: Perfil[] = [];
  gravarPerfil = (p: Perfil) => {
    this.gravados.push(p);
    return Promise.resolve();
  };
  gruposNaNuvem: Record<string, Grupo> = {};
  lerGrupo = (codigo: string) => Promise.resolve(this.gruposNaNuvem[codigo] ?? null);
  criarGrupo = (g: Grupo) => {
    this.gruposNaNuvem[g.id] = g;
    return Promise.resolve(true);
  };
  chamadas: string[] = [];
  entrarNoGrupo = (codigo: string, uid: string) => this.registrar(`entrar ${codigo} ${uid}`);
  pedirEntrada = (codigo: string, uid: string) => this.registrar(`pedir ${codigo} ${uid}`);
  responderPedido = (codigo: string, uid: string, aceitar: boolean) => this.registrar(`responder ${codigo} ${uid} ${aceitar}`);
  definirAcesso = (codigo: string, acesso: string) => this.registrar(`acesso ${codigo} ${acesso}`);
  sairDoGrupo = (codigo: string, uid: string, novoDono?: string) => this.registrar(`sair ${codigo} ${uid} ${novoDono ?? ''}`.trim());
  ligar = (a: string, b: string, grupo: string) => this.registrar(`ligar ${chaveConexao(a, b)} ${grupo}`);
  desligar = (a: string, b: string, grupo: string) => this.registrar(`desligar ${chaveConexao(a, b)} ${grupo}`);
  private registrar(chamada: string): Promise<void> {
    this.chamadas.push(chamada);
    return Promise.resolve();
  }
  publicados: Evento[] = [];
  publicarEvento = (e: Evento) => {
    this.publicados.push(e);
    return Promise.resolve();
  };
  fotos = new Map<string, string>();
  leiturasDeFoto = 0;
  falhaFoto?: { code: string };
  gravarFoto = (uid: string, sessaoId: string, dados: string) => {
    if (this.falhaFoto) return Promise.reject(this.falhaFoto);
    this.fotos.set(`${uid}/${sessaoId}`, dados);
    return Promise.resolve();
  };
  apagarFoto = (uid: string, sessaoId: string) => {
    this.fotos.delete(`${uid}/${sessaoId}`);
    return Promise.resolve();
  };
  lerFoto = (uid: string, sessaoId: string) => {
    this.leiturasDeFoto++;
    if (this.falhaFoto) return Promise.reject(this.falhaFoto);
    return Promise.resolve(this.fotos.get(`${uid}/${sessaoId}`) ?? null);
  };
  marcadosNoEvento: { uid: string; eventoId: string; tem: boolean }[] = [];
  marcarFotoEvento = (uid: string, eventoId: string, tem: boolean) => {
    this.marcadosNoEvento.push({ uid, eventoId, tem });
    return Promise.resolve();
  };
  curtir = () => Promise.resolve();
  descurtir = () => Promise.resolve();
  comentar = () => Promise.resolve();
  apagarComentario = () => Promise.resolve();
  curtidas = new Map<string, Ouvinte<string[]>>();
  comentarios = new Map<string, Ouvinte<Comentario[]>>();
  atividadesCb?: (a: Atividade[]) => void;
  limiteAtividades?: number;
  ouvirAtividades = (_uid: string, cb: (a: Atividade[]) => void, _erro?: unknown, limite?: number) => {
    this.atividadesCb = cb;
    this.limiteAtividades = limite;
    return () => undefined;
  };

  ouvirGrupos(_uid: string, cb: (g: Grupo[]) => void, erro: (e: unknown) => void): () => void {
    const o = ouvinte(cb, erro);
    this.grupos = o;
    return () => (o.cancelado = true);
  }

  ouvirConexoes(_uid: string, cb: (c: Conexao[]) => void, erro: (e: unknown) => void): () => void {
    const o = ouvinte(cb, erro);
    this.conexoes = o;
    return () => (o.cancelado = true);
  }

  /** Atalho dos testes: um grupo `g1` com a pessoa e quem estiver na lista, e a ligação com cada um. */
  emitirColegas(...outros: string[]): void {
    const g: Grupo = { id: 'g1', nome: 'Grupo', dono: 'eu', membros: ['eu', ...outros], acesso: 'aberto', pedidos: [], criadoEm: 1 };
    this.grupos?.cb(outros.length ? [g] : []);
    this.conexoes?.cb(outros.map((o) => ({ id: chaveConexao('eu', o), membros: ['eu', o].sort(), grupos: ['g1'] })));
  }

  ouvirCurtidas(dono: string, eventoId: string, cb: (u: string[]) => void, erro: (e: unknown) => void): () => void {
    const o = ouvinte(cb, erro);
    this.curtidas.set(`${dono}/${eventoId}`, o);
    return () => (o.cancelado = true);
  }

  ouvirComentarios(dono: string, eventoId: string, cb: (c: Comentario[]) => void, erro: (e: unknown) => void): () => void {
    const o = ouvinte(cb, erro);
    this.comentarios.set(`${dono}/${eventoId}`, o);
    return () => (o.cancelado = true);
  }

  ouvirEventos(uid: string, cb: (e: Evento[]) => void, erro: (e: unknown) => void, limite?: number): () => void {
    const o = ouvinte(cb, erro, limite);
    this.eventos.set(uid, o);
    return () => (o.cancelado = true);
  }
}

class NuvemFalsa implements NuvemBackend {
  sessoes = new Map<string, Ouvinte<Sessao[]>>();

  ouvirEstado = () => () => undefined;
  gravarEstado = () => Promise.resolve();
  gravarSessao = () => Promise.resolve();
  aguardarGravacoes = () => Promise.resolve();

  ouvirSessoes(uid: string, cb: (s: Sessao[]) => void, erro: (e: unknown) => void, limite?: number): () => void {
    const o = ouvinte(cb, erro, limite);
    this.sessoes.set(uid, o);
    return () => (o.cancelado = true);
  }
}

const evento = (autor: string, criadoEm: number): Evento => ({
  id: `ev${criadoEm}`,
  autor,
  autorNome: autor,
  autorFoto: null,
  tipo: 'treino',
  criadoEm,
  sessaoId: 's',
  data: '2026-10-22',
  fichaNome: 'A',
  exercicios: 3,
  volume: 100,
  recordes: [],
});

describe('SocialService', () => {
  let medalhas: { pronto: () => boolean; ganhosDoTreino: jasmine.Spy };
  let marcadas: { id: string; tem: boolean }[];
  let api: ApiFalsa;
  let nuvem: NuvemFalsa;
  let social: SocialService;
  let cloud: { social: ReturnType<typeof signal<{ uid: string; api: SocialBackend; nuvem: NuvemBackend } | null>>; usuario: ReturnType<typeof signal> };

  /** Deixa efeitos e promessas terminarem. */
  async function assentar(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      TestBed.tick();
      for (let j = 0; j < 10; j++) await Promise.resolve();
    }
  }

  /** Entra na conta e recebe um grupo com estas pessoas. */
  async function entrarComAmigos(...outros: string[]): Promise<void> {
    cloud.social.set({ uid: 'eu', api, nuvem });
    await assentar();
    api.emitirColegas(...outros);
    await assentar();
  }

  beforeEach(() => {
    localStorage.clear();
    marcadas = [];
    medalhas = { pronto: () => true, ganhosDoTreino: jasmine.createSpy('ganhosDoTreino').and.returnValue([]) };
    api = new ApiFalsa();
    api.perfis['ana'] = { uid: 'ana', nome: 'Ana', foto: null };
    api.perfis['bia'] = { uid: 'bia', nome: 'Bia', foto: null };
    api.perfis['caio'] = { uid: 'caio', nome: 'Caio', foto: null };
    nuvem = new NuvemFalsa();
    cloud = { social: signal<{ uid: string; api: SocialBackend; nuvem: NuvemBackend } | null>(null), usuario: signal({ uid: 'eu', nome: 'Eu', email: 'eu@x.com', foto: null }) };
    TestBed.configureTestingModule({
      providers: [
        { provide: CloudService, useValue: cloud },
        { provide: PlanService, useValue: { historico: signal<Sessao[]>([]), get: () => undefined, marcarFoto: (id: string, tem: boolean) => marcadas.push({ id, tem }) } },
        { provide: MedalhasService, useValue: medalhas },
        { provide: ExerciseService, useValue: { get: () => undefined, nome: () => '' } },
      ],
    });
    social = TestBed.inject(SocialService);
  });

  it('ao entrar, cria o perfil e passa a ouvir os grupos', async () => {
    cloud.social.set({ uid: 'eu', api, nuvem });
    await assentar();
    expect(social.eu()?.uid).toBe('eu');
    expect(api.grupos).toBeDefined();
    expect(api.conexoes).toBeDefined();
  });

  it('acompanha os treinos publicados de cada pessoa do grupo e os próprios', async () => {
    await entrarComAmigos('ana');
    expect([...api.eventos.keys()].sort()).toEqual(['ana', 'eu']);
    expect(social.membrosDe(social.grupos()[0]).map((p) => p.nome)).toEqual(['Eu', 'Ana']);
  });

  it('quem não está em nenhum grupo comigo não é ouvido', async () => {
    await entrarComAmigos();
    expect([...api.eventos.keys()]).toEqual(['eu']);
    expect(social.grupos().length).toBe(0);
    expect(social.podeVer('ana')).toBeFalse();
  });

  it('só quem divide um grupo comigo pode ter os treinos vistos', async () => {
    await entrarComAmigos('ana');
    expect(social.podeVer('ana')).toBeTrue();
    expect(social.podeVer('eu')).toBeTrue();
    expect(social.podeVer('bia')).toBeFalse();
  });

  describe('foto do perfil', () => {
    it('trocar a foto grava no perfil e passa a valer em lugar da foto do Google', async () => {
      cloud.usuario.set({ uid: 'eu', nome: 'Eu', email: 'eu@x.com', foto: 'https://google/foto.jpg' });
      cloud.social.set({ uid: 'eu', api, nuvem });
      await assentar();
      expect(social.meuUsuario()?.foto).toBe('https://google/foto.jpg');
      await social.trocarFoto('data:image/jpeg;base64,AAA');
      expect(api.gravados.at(-1)).toEqual(jasmine.objectContaining({ foto: 'data:image/jpeg;base64,AAA', fotoPropria: true }));
      expect(social.meuUsuario()?.foto).toBe('data:image/jpeg;base64,AAA');
    });

    it('ao entrar de novo, a foto escolhida no app não é trocada pela do Google', async () => {
      api.perfis['eu'] = { uid: 'eu', nome: 'Eu', foto: 'data:image/jpeg;base64,MINHA', fotoPropria: true };
      cloud.usuario.set({ uid: 'eu', nome: 'Eu', email: 'eu@x.com', foto: 'https://google/foto.jpg' });
      cloud.social.set({ uid: 'eu', api, nuvem });
      await assentar();
      expect(social.eu()?.foto).toBe('data:image/jpeg;base64,MINHA');
    });

    it('sem foto escolhida, a foto do Google entra no perfil', async () => {
      cloud.usuario.set({ uid: 'eu', nome: 'Eu', email: 'eu@x.com', foto: 'https://google/foto.jpg' });
      cloud.social.set({ uid: 'eu', api, nuvem });
      await assentar();
      expect(social.eu()?.foto).toBe('https://google/foto.jpg');
      expect(social.eu()?.fotoPropria).toBeFalse();
    });

    it('usar a foto da conta desfaz a escolha', async () => {
      cloud.usuario.set({ uid: 'eu', nome: 'Eu', email: 'eu@x.com', foto: 'https://google/foto.jpg' });
      cloud.social.set({ uid: 'eu', api, nuvem });
      await assentar();
      await social.trocarFoto('data:image/jpeg;base64,AAA');
      await social.usarFotoDaConta();
      expect(social.eu()?.foto).toBe('https://google/foto.jpg');
      expect(social.eu()?.fotoPropria).toBeFalse();
    });

    it('treinos publicados não carregam a foto escolhida no app, só o perfil', async () => {
      cloud.social.set({ uid: 'eu', api, nuvem });
      await assentar();
      await social.trocarFoto('data:image/jpeg;base64,AAA');
      expect(fotoParaItens(social.eu()!)).toBeNull();
    });

    it('se não salvar, a foto não muda na tela', async () => {
      cloud.social.set({ uid: 'eu', api, nuvem });
      await assentar();
      api.gravarPerfil = () => Promise.reject(new Error('sem rede'));
      await expectAsync(social.trocarFoto('data:image/jpeg;base64,AAA')).toBeRejected();
      expect(social.eu()?.fotoPropria).toBeFalsy();
    });
  });

  describe('estatísticas de outros membros', () => {
    it('lê só os treinos mais recentes do amigo', async () => {
      await entrarComAmigos('ana');
      social.sessoesDe('ana');
      expect(nuvem.sessoes.get('ana')?.limite).toBe(LIMITE_SESSOES_MEMBRO);
    });

    it('abre uma única leitura por amigo, mesmo consultando várias vezes', async () => {
      await entrarComAmigos('ana');
      const abrir = spyOn(nuvem, 'ouvirSessoes').and.callThrough();
      social.sessoesDe('ana');
      social.sessoesDe('ana');
      expect(abrir).toHaveBeenCalledTimes(1);
    });

    it('os próprios treinos não passam por aqui', async () => {
      await entrarComAmigos('ana');
      social.sessoesDe('eu');
      expect(nuvem.sessoes.has('eu')).toBeFalse();
    });
  });

  describe('quando deixam de dividir um grupo', () => {
    it('para de ouvir os treinos publicados e o histórico do ex-colega', async () => {
      await entrarComAmigos('ana');
      social.sessoesDe('ana');
      nuvem.sessoes.get('ana')?.cb([{ id: 's1', data: '2026-10-20', fichaId: 'f1' }]);
      expect(social.sessoesCarregadas('ana')).toBeTrue();

      api.emitirColegas();
      await assentar();

      expect(api.eventos.get('ana')?.cancelado).toBeTrue();
      expect(nuvem.sessoes.get('ana')?.cancelado).toBeTrue();
      expect(social.sessoesCarregadas('ana')).toBeFalse();
      expect(api.eventos.get('eu')?.cancelado).toBeFalse();
    });

    it('se voltarem a ser amigos, volta a ouvir', async () => {
      await entrarComAmigos('ana');
      social.sessoesDe('ana');
      api.emitirColegas();
      await assentar();
      api.emitirColegas('ana');
      await assentar();
      social.sessoesDe('ana');
      expect(api.eventos.get('ana')?.cancelado).toBeFalse();
      expect(nuvem.sessoes.get('ana')?.cancelado).toBeFalse();
    });

    it('"sem permissão" de um amigo que nos tirou da lista não vira aviso na tela', async () => {
      await entrarComAmigos('ana');
      social.sessoesDe('ana');

      api.eventos.get('ana')?.erro({ code: 'permission-denied' });
      nuvem.sessoes.get('ana')?.erro({ code: 'permission-denied' });

      expect(social.erro()).toBe('');
      expect(api.eventos.get('ana')?.cancelado).toBeTrue();
      expect(nuvem.sessoes.get('ana')?.cancelado).toBeTrue();
    });
  });

  describe('erros', () => {
    it('o erro diz em que operação falhou, para dar para diagnosticar pelo celular', async () => {
      await entrarComAmigos('ana');
      api.gravarFoto = () => Promise.reject({ code: 'permission-denied' });
      await social.salvarFoto('s1', 'data:image/jpeg;base64,AAAA');
      expect(social.erro()).toContain('ao gravar foto do treino');
      expect(social.erro()).toContain('Sem permissão');
    });

    it('"sem permissão" nos próprios dados pede para publicar as regras do Firestore', async () => {
      await entrarComAmigos('ana');
      api.eventos.get('eu')?.erro({ code: 'permission-denied' });
      expect(social.erro()).toContain('Publique as regras');
    });

    it('outro erro ao ouvir um amigo continua avisando', async () => {
      await entrarComAmigos('ana');
      api.eventos.get('ana')?.erro({ code: 'unavailable' });
      expect(social.erro()).toContain('Não foi possível falar com o servidor');
    });

    describe('curtidas e comentários de um treino', () => {
      it('"sem permissão" nas reações de um treino seu pede para publicar as regras', async () => {
        await entrarComAmigos('ana');
        social.ouvirCurtidas('eu', 'e1', () => undefined);
        social.ouvirComentarios('eu', 'e1', () => undefined);
        api.curtidas.get('eu/e1')?.erro({ code: 'permission-denied' });
        expect(social.erro()).toContain('Publique as regras');
      });

      it('o erro ao ler os comentários também aparece (não vira "sem comentários")', async () => {
        await entrarComAmigos('ana');
        const recebeu = jasmine.createSpy('recebeu');
        social.ouvirComentarios('ana', 'e1', recebeu);
        api.comentarios.get('ana/e1')?.erro({ code: 'unavailable' });
        expect(social.erro()).toContain('Não foi possível falar com o servidor');
        expect(recebeu).not.toHaveBeenCalled();
      });

      it('"sem permissão" nas reações de um ex-colega não vira aviso e solta a pessoa', async () => {
        await entrarComAmigos('ana');
        social.ouvirCurtidas('ana', 'e1', () => undefined);
        api.curtidas.get('ana/e1')?.erro({ code: 'permission-denied' });
        expect(social.erro()).toBe('');
        expect(api.eventos.get('ana')?.cancelado).toBeTrue();
      });

      it('sem conta, não há o que ouvir e nada quebra', () => {
        const parar = social.ouvirCurtidas('ana', 'e1', () => undefined);
        expect(() => parar()).not.toThrow();
        expect(api.curtidas.size).toBe(0);
      });
    });
  });

  describe('nome e foto atuais', () => {
    it('prefere o perfil atual ao nome gravado no treino', async () => {
      api.perfis['ana'] = { uid: 'ana', nome: 'Ana Nova', foto: 'nova.png' };
      await entrarComAmigos('ana');
      expect(social.nomeDe('ana', 'Ana Antiga')).toBe('Ana Nova');
      expect(social.fotoDe('ana', 'velha.png')).toBe('nova.png');
    });

    it('quem tirou a foto aparece sem foto, não com a antiga', async () => {
      api.perfis['ana'] = { uid: 'ana', nome: 'Ana', foto: null };
      await entrarComAmigos('ana');
      expect(social.fotoDe('ana', 'velha.png')).toBeNull();
    });

    it('o próprio perfil vem direto, sem busca', async () => {
      await entrarComAmigos();
      const ler = spyOn(api, 'lerPerfil').and.callThrough();
      expect(social.nomeDe('eu', 'nome antigo')).toBe('Eu');
      expect(ler).not.toHaveBeenCalled();
    });

    it('de quem não é do grupo, usa o gravado e busca o perfil em segundo plano', async () => {
      api.perfis['bia'] = { uid: 'bia', nome: 'Bia Atual', foto: null };
      await entrarComAmigos('ana');
      const ler = spyOn(api, 'lerPerfil').and.callThrough();

      expect(social.nomeDe('bia', 'Bia Gravada')).toBe('Bia Gravada');
      await assentar();

      expect(social.nomeDe('bia', 'Bia Gravada')).toBe('Bia Atual');
      expect(ler).toHaveBeenCalledOnceWith('bia');
    });

    it('não repete a busca de um perfil que não existe', async () => {
      await entrarComAmigos();
      const ler = spyOn(api, 'lerPerfil').and.callThrough();
      for (let i = 0; i < 3; i++) social.nomeDe('zed', 'Zed');
      await assentar();
      expect(social.nomeDe('zed', 'Zed')).toBe('Zed');
      expect(ler).toHaveBeenCalledTimes(1);
    });

    it('uma falha na busca não gera uma nova tentativa a cada leitura', async () => {
      await entrarComAmigos();
      const ler = spyOn(api, 'lerPerfil').and.callFake(() => Promise.reject(new Error('sem rede')));
      for (let i = 0; i < 3; i++) social.nomeDe('bia', 'Bia');
      await assentar();
      social.nomeDe('bia', 'Bia');
      expect(ler).toHaveBeenCalledTimes(1);
    });

    it('amigo cujo perfil falhou ao carregar é tentado de novo na próxima atualização da lista', async () => {
      await entrarComAmigos();
      let falhar = true;
      const ler = spyOn(api, 'lerPerfil').and.callFake((uid: string) => (falhar ? Promise.reject(new Error('sem rede')) : Promise.resolve(api.perfis[uid] ?? null)));

      api.emitirColegas('ana');
      await assentar();
      expect(ler).toHaveBeenCalledTimes(1);

      falhar = false;
      api.emitirColegas('ana');
      await assentar();
      expect(social.perfilDe('ana')?.nome).toBe('Ana');
    });

    it('sem conta, devolve o gravado e não busca nada', () => {
      const ler = spyOn(api, 'lerPerfil').and.callThrough();
      expect(social.nomeDe('ana', 'Ana Gravada')).toBe('Ana Gravada');
      expect(social.fotoDe('ana', 'foto.png')).toBe('foto.png');
      expect(ler).not.toHaveBeenCalled();
    });
  });

  it('ao sair da conta, para tudo e limpa os dados', async () => {
    await entrarComAmigos('ana');
    social.sessoesDe('ana');

    cloud.social.set(null);
    await assentar();

    expect(api.grupos?.cancelado).toBeTrue();
    expect(api.eventos.get('ana')?.cancelado).toBeTrue();
    expect(api.eventos.get('eu')?.cancelado).toBeTrue();
    expect(nuvem.sessoes.get('ana')?.cancelado).toBeTrue();
    expect(social.eu()).toBeNull();
    expect(social.grupos()).toEqual([]);
  });
  describe('novidades na timeline', () => {
    const futuro = () => Date.now() + 60_000;

    it('um treino novo de amigo vira novidade e some quando a timeline é vista', async () => {
      await entrarComAmigos('ana');
      expect(social.novidades()).toBe(0);
      api.eventos.get('ana')?.cb([evento('ana', futuro())]);
      await assentar();
      expect(social.novidades()).toBe(1);
      social.marcarTimelineVista();
      expect(social.novidades()).toBe(0);
    });

    it('o que já existia antes da primeira entrada não conta como novidade', async () => {
      await entrarComAmigos('ana');
      api.eventos.get('ana')?.cb([evento('ana', 1000)]);
      await assentar();
      expect(social.novidades()).toBe(0);
    });

    it('pedidos de entrada nos meus grupos entram no aviso da aba e saem quando respondidos', async () => {
      cloud.social.set({ uid: 'eu', api, nuvem });
      await assentar();
      const g: Grupo = { id: 'g1', nome: 'Grupo', dono: 'eu', membros: ['eu'], acesso: 'aprovado', pedidos: ['bia'], criadoEm: 1 };
      api.grupos?.cb([g]);
      await assentar();
      expect(social.novidades()).toBe(0);
      expect(social.pedidosRecebidos().map((p) => p.perfil.uid)).toEqual(['bia']);
      expect(social.avisosDaAba()).toBe(1);
      api.grupos?.cb([{ ...g, pedidos: [] }]);
      await assentar();
      expect(social.avisosDaAba()).toBe(0);
    });

    it('pedidos em grupos de outra pessoa não contam como aviso', async () => {
      cloud.social.set({ uid: 'eu', api, nuvem });
      await assentar();
      api.grupos?.cb([{ id: 'g2', nome: 'Outro', dono: 'ana', membros: ['ana', 'eu'], acesso: 'aprovado', pedidos: ['bia'], criadoEm: 1 }]);
      await assentar();
      expect(social.avisosDaAba()).toBe(0);
    });

    it('os próprios treinos não contam', async () => {
      await entrarComAmigos('ana');
      api.eventos.get('eu')?.cb([evento('eu', futuro())]);
      await assentar();
      expect(social.novidades()).toBe(0);
    });

    it('curtidas e comentários de amigos também contam', async () => {
      await entrarComAmigos('ana');
      api.atividadesCb?.([{ id: 'a1', autor: 'ana', autorNome: 'Ana', autorFoto: null, tipo: 'curtida', eventoId: 'e1', criadoEm: futuro() }]);
      await assentar();
      expect(social.novidades()).toBe(1);
    });

    it('guarda até onde foi visto, por conta, para não avisar de novo ao reabrir o app', async () => {
      await entrarComAmigos('ana');
      const t = futuro();
      api.eventos.get('ana')?.cb([evento('ana', t)]);
      await assentar();
      social.marcarTimelineVista();
      expect(localStorage.getItem('app-workout:social-visto:v1:eu')).toBe(String(t));
    });
  });
  describe('timeline em páginas', () => {
    const lote = (autor: string, n: number, de = 1000) => Array.from({ length: n }, (_, i) => evento(autor, de + i));

    it('mostra só a primeira página e libera mais ao chegar ao fim', async () => {
      await entrarComAmigos('ana');
      api.eventos.get('ana')?.cb(lote('ana', 15));
      await assentar();
      expect(social.timeline().length).toBe(15);
      expect(social.timelineVisivelDe('g1').length).toBe(PAGINA_TIMELINE);
      expect(social.timelineVisivelDe('g1')[0].criadoEm).toBe(1014); // do mais novo para o mais antigo
      expect(social.temMaisDe('g1')).toBeTrue();

      social.carregarMais('g1');
      expect(social.timelineVisivelDe('g1').length).toBe(15);
    });

    it('já lido e escondido não abre nova leitura na nuvem', async () => {
      await entrarComAmigos('ana', 'bia');
      api.eventos.get('ana')?.cb(lote('ana', 14));
      api.eventos.get('bia')?.cb(lote('bia', 14, 2000)); // 28 lidos, nenhuma leitura cheia
      await assentar();
      expect(social.timelineVisivelDe('g1').length).toBe(PAGINA_TIMELINE);
      const aberto = api.eventos.get('ana');
      social.carregarMais('g1'); // 20 de 28: já está lido
      expect(social.timelineVisivelDe('g1').length).toBe(20);
      expect(api.eventos.get('ana')).toBe(aberto);
      expect(aberto?.cancelado).toBeFalse();
    });

    it('leitura que veio cheia pede mais à nuvem quando a tela alcança o fim', async () => {
      await entrarComAmigos('ana');
      const primeiro = api.eventos.get('ana')!;
      expect(primeiro.limite).toBe(15);
      primeiro.cb(lote('ana', 15)); // veio no limite: pode haver mais
      await assentar();
      social.carregarMais('g1'); // mostra 15 (tudo o que foi lido)
      social.carregarMais('g1'); // quer 20, só há 15 -> abre leitura maior
      const segundo = api.eventos.get('ana')!;
      expect(primeiro.cancelado).toBeTrue();
      expect(segundo).not.toBe(primeiro);
      expect(segundo.limite).toBe(30);
      expect(api.limiteAtividades).toBe(60);
      // o que já chegou continua na tela até o novo resultado
      expect(social.timeline().length).toBe(15);
    });

    it('leitura parcial é o fim: some o "tem mais" e nada novo é pedido', async () => {
      await entrarComAmigos('ana');
      api.eventos.get('ana')?.cb(lote('ana', 12));
      await assentar();
      social.carregarMais('g1');
      expect(social.timelineVisivelDe('g1').length).toBe(12);
      expect(social.temMaisDe('g1')).toBeFalse();
      const aberto = api.eventos.get('ana');
      social.carregarMais('g1');
      expect(api.eventos.get('ana')).toBe(aberto);
    });

    it('novos itens depois da leitura ampliada entram na lista', async () => {
      await entrarComAmigos('ana');
      api.eventos.get('ana')?.cb(lote('ana', 15));
      await assentar();
      social.carregarMais('g1');
      social.carregarMais('g1');
      api.eventos.get('ana')?.cb(lote('ana', 22)); // agora a nuvem devolveu 22 (< 30): fim
      await assentar();
      expect(social.timeline().length).toBe(22);
      expect(social.temMaisDe('g1')).toBeTrue(); // ainda há 2 fora da tela (20 de 22)
      social.carregarMais('g1');
      expect(social.timelineVisivelDe('g1').length).toBe(22);
      expect(social.temMaisDe('g1')).toBeFalse();
    });
  });
  describe('foto do treino', () => {
    const meuEvento = (): Evento => ({ ...evento('eu', 5), sessaoId: 's1' });

    it('salvar guarda a foto na nuvem e deixa a leitura imediata, sem ir buscar de novo', async () => {
      await entrarComAmigos();
      expect(await social.salvarFoto('s1', 'data:image/jpeg;base64,AAA')).toBeTrue();
      expect(api.fotos.get('eu/s1')).toBe('data:image/jpeg;base64,AAA');
      expect(await social.lerFoto('eu', 's1')).toBe('data:image/jpeg;base64,AAA');
      expect(api.leiturasDeFoto).toBe(0);
    });

    it('ler a mesma foto duas vezes busca uma só', async () => {
      await entrarComAmigos('ana');
      api.fotos.set('ana/sx', 'data:image/jpeg;base64,BBB');
      const [a, b] = await Promise.all([social.lerFoto('ana', 'sx'), social.lerFoto('ana', 'sx')]);
      expect(a).toBe('data:image/jpeg;base64,BBB');
      expect(b).toBe(a);
      expect(api.leiturasDeFoto).toBe(1);
    });

    it('treino sem foto devolve null, e uma falha de leitura não fica guardada', async () => {
      await entrarComAmigos('ana');
      expect(await social.lerFoto('ana', 'nada')).toBeNull();
      api.falhaFoto = { code: 'unavailable' };
      expect(await social.lerFoto('ana', 'sy')).toBeNull();
      api.falhaFoto = undefined;
      api.fotos.set('ana/sy', 'data:image/jpeg;base64,CCC');
      expect(await social.lerFoto('ana', 'sy')).toBe('data:image/jpeg;base64,CCC');
    });

    it('foto que não pode ser lida (ex.: regra ainda não publicada) não derruba o amigo nem mostra erro', async () => {
      spyOn(console, 'warn');
      await entrarComAmigos('ana');
      api.eventos.get('ana')?.cb([evento('ana', 7)]);
      await assentar();
      api.falhaFoto = { code: 'permission-denied' };
      expect(await social.lerFoto('ana', 'sz')).toBeNull();
      await assentar();
      expect(social.podeVer('ana')).toBeTrue();
      expect(api.eventos.get('ana')?.cancelado).toBeFalse();
      expect(social.erro()).toBe('');
    });

    it('falha ao salvar devolve falso, avisa na tela e não deixa a foto no cache', async () => {
      await entrarComAmigos();
      api.falhaFoto = { code: 'permission-denied' };
      expect(await social.salvarFoto('s1', 'data:image/jpeg;base64,AAA')).toBeFalse();
      expect(social.erro()).toContain('Sem permissão');
      api.falhaFoto = undefined;
      expect(await social.lerFoto('eu', 's1')).toBeNull();
    });

    it('colocar foto num card seu grava, marca o treino e liga o aviso no card publicado', async () => {
      await entrarComAmigos();
      expect(await social.definirFoto(meuEvento(), 'data:image/jpeg;base64,DDD')).toBeTrue();
      expect(api.fotos.get('eu/s1')).toBe('data:image/jpeg;base64,DDD');
      expect(marcadas).toEqual([{ id: 's1', tem: true }]);
      expect(api.marcadosNoEvento).toEqual([{ uid: 'eu', eventoId: 'ev5', tem: true }]);
    });

    it('tirar a foto apaga na nuvem, desmarca o treino e desliga o aviso', async () => {
      await entrarComAmigos();
      await social.definirFoto(meuEvento(), 'data:image/jpeg;base64,DDD');
      expect(await social.definirFoto(meuEvento(), null)).toBeTrue();
      expect(api.fotos.has('eu/s1')).toBeFalse();
      expect(marcadas.at(-1)).toEqual({ id: 's1', tem: false });
      expect(api.marcadosNoEvento.at(-1)).toEqual({ uid: 'eu', eventoId: 'ev5', tem: false });
      expect(await social.lerFoto('eu', 's1')).toBeNull();
    });

    it('não mexe na foto do treino de um amigo', async () => {
      await entrarComAmigos('ana');
      expect(await social.definirFoto({ ...evento('ana', 6), sessaoId: 'sa' }, 'data:image/jpeg;base64,EEE')).toBeFalse();
      expect(api.fotos.size).toBe(0);
    });

    it('o card publicado de um treino com foto leva o aviso temFoto', async () => {
      const plans = TestBed.inject(PlanService) as unknown as { historico: ReturnType<typeof signal<Sessao[]>> };
      plans.historico.set([{ id: 'sf', data: '2026-10-23', fichaId: 'f', fichaNome: 'A', concluidaEm: Date.now(), registros: [], temFoto: true }]);
      await entrarComAmigos();
      await assentar();
      const publicado = api.publicados.find((e) => e.sessaoId === 'sf');
      expect(publicado?.temFoto).toBeTrue();
    });

    it('treino sem foto é publicado sem o aviso', async () => {
      const plans = TestBed.inject(PlanService) as unknown as { historico: ReturnType<typeof signal<Sessao[]>> };
      plans.historico.set([{ id: 'sg', data: '2026-10-23', fichaId: 'f', fichaNome: 'A', concluidaEm: Date.now(), registros: [] }]);
      await entrarComAmigos();
      await assentar();
      const publicado = api.publicados.find((e) => e.sessaoId === 'sg');
      expect(publicado).toBeDefined();
      expect(publicado?.temFoto).toBeUndefined();
    });
  });
  describe('gente nova nos grupos', () => {
    const grupo = (membros: string[], id = 'g1'): Grupo => ({ id, nome: 'Grupo', dono: 'eu', membros, acesso: 'aberto', pedidos: [], criadoEm: 1 });

    async function comGrupo(membros: string[]): Promise<void> {
      cloud.social.set({ uid: 'eu', api, nuvem });
      await assentar();
      api.grupos?.cb([grupo(membros)]);
      await assentar();
    }

    it('quem já estava no grupo quando o app o conheceu não é novo', async () => {
      await comGrupo(['eu', 'ana']);
      expect(social.novosMembros()).toBe(0);
      expect(social.avisosDaAba()).toBe(0);
    });

    it('quem entra depois vira aviso na aba e no grupo, e some quando o grupo é aberto', async () => {
      await comGrupo(['eu', 'ana']);
      api.grupos?.cb([grupo(['eu', 'ana', 'bia', 'caio'])]);
      await assentar();
      expect(social.novosMembrosDe('g1')).toBe(2);
      expect(social.avisosDaAba()).toBe(2);

      social.marcarMembrosVistos('g1');
      expect(social.novosMembrosDe('g1')).toBe(0);
      expect(social.avisosDaAba()).toBe(0);
    });

    it('o que já foi visto continua visto ao reabrir o app', async () => {
      await comGrupo(['eu', 'ana']);
      api.grupos?.cb([grupo(['eu', 'ana', 'bia'])]);
      await assentar();
      social.marcarMembrosVistos('g1');

      cloud.social.set(null);
      await assentar();
      await comGrupo(['eu', 'ana', 'bia']);
      expect(social.novosMembros()).toBe(0);
    });

    it('a própria pessoa entrando em outro grupo não conta como gente nova', async () => {
      await comGrupo(['eu', 'ana']);
      api.grupos?.cb([grupo(['eu', 'ana']), grupo(['bia', 'eu'], 'g2')]);
      await assentar();
      expect(social.novosMembros()).toBe(0);
    });
  });

  describe('medalhas na timeline', () => {
    const concluir = (id: string) => {
      const plans = TestBed.inject(PlanService) as unknown as { historico: ReturnType<typeof signal<Sessao[]>> };
      plans.historico.set([{ id, data: '2026-10-23', fichaId: 'f', fichaNome: 'A', concluidaEm: Date.now(), registros: [] }]);
    };

    it('o treino que fez subir de nível leva as medalhas no card publicado', async () => {
      medalhas.ganhosDoTreino.and.returnValue([{ id: 'treinos', nivel: 'bronze', titulo: 'Treinos' }]);
      concluir('sm');
      await entrarComAmigos();
      await assentar();
      expect(api.publicados.find((e) => e.sessaoId === 'sm')?.medalhas).toEqual([{ id: 'treinos', nivel: 'bronze', titulo: 'Treinos' }]);
    });

    it('sem nível novo, o card não leva o campo', async () => {
      concluir('sn');
      await entrarComAmigos();
      await assentar();
      const publicado = api.publicados.find((e) => e.sessaoId === 'sn');
      expect(publicado).toBeDefined();
      expect('medalhas' in publicado!).toBeFalse();
    });

    it('espera o catálogo de exercícios ficar pronto para publicar', async () => {
      medalhas.pronto = () => false;
      concluir('so');
      await entrarComAmigos();
      await assentar();
      expect(api.publicados.length).toBe(0);
    });
  });

  describe('grupos', () => {
    const grupoDe = (campos: Partial<Grupo> = {}): Grupo => ({ id: 'ABCD2345', nome: 'Trabalho', dono: 'ana', membros: ['ana'], acesso: 'aberto', pedidos: [], criadoEm: 1, ...campos });

    it('criar grupo grava com a pessoa como dona e única membro', async () => {
      await entrarComAmigos();
      const g = await social.criarGrupo('  Grupo do Trabalho ');
      expect(g?.nome).toBe('Grupo do Trabalho');
      expect(g?.dono).toBe('eu');
      expect(g?.membros).toEqual(['eu']);
      expect(g?.id).toMatch(/^[A-Z2-9]{8}$/);
      expect(api.gruposNaNuvem[g!.id]).toBeDefined();
      expect(social.grupo(g!.id)).toBeDefined();
    });

    it('não cria grupo sem nome', async () => {
      await entrarComAmigos();
      expect(await social.criarGrupo('   ')).toBeNull();
    });

    it('link de grupo aberto: entra na hora', async () => {
      api.gruposNaNuvem['ABCD2345'] = grupoDe();
      await entrarComAmigos();
      const r = await social.entrarPorCodigo('abcd-2345');
      expect(r.estado).toBe('entrou');
      expect(api.chamadas).toContain('entrar ABCD2345 eu');
    });

    it('link de grupo com aprovação: pede para entrar uma única vez', async () => {
      api.gruposNaNuvem['ABCD2345'] = grupoDe({ acesso: 'aprovado' });
      await entrarComAmigos();
      expect((await social.entrarPorCodigo('ABCD2345')).estado).toBe('pedido-enviado');
      expect(api.chamadas).toContain('pedir ABCD2345 eu');
      api.gruposNaNuvem['ABCD2345'] = grupoDe({ acesso: 'aprovado', pedidos: ['eu'] });
      expect((await social.entrarPorCodigo('ABCD2345')).estado).toBe('pedido-pendente');
      expect(api.chamadas.filter((c) => c.startsWith('pedir'))).toEqual(['pedir ABCD2345 eu']);
    });

    it('quem já é membro não entra de novo', async () => {
      api.gruposNaNuvem['ABCD2345'] = grupoDe({ membros: ['ana', 'eu'] });
      await entrarComAmigos();
      expect((await social.entrarPorCodigo('ABCD2345')).estado).toBe('ja-membro');
      expect(api.chamadas).toEqual([]);
    });

    it('código que não existe ou está incompleto', async () => {
      await entrarComAmigos();
      expect((await social.entrarPorCodigo('ZZZZ9999')).estado).toBe('inexistente');
      expect((await social.entrarPorCodigo('ABC')).estado).toBe('inexistente');
    });

    it('liga a pessoa a cada membro do grupo que ainda não tem ligação', async () => {
      cloud.social.set({ uid: 'eu', api, nuvem });
      await assentar();
      api.conexoes?.cb([{ id: 'ana_eu', membros: ['ana', 'eu'], grupos: ['g1'] }]);
      api.grupos?.cb([grupoDe({ id: 'g1', membros: ['ana', 'bia', 'eu'] })]);
      await assentar();
      expect(api.chamadas).toEqual(['ligar bia_eu g1']);
    });

    it('sair do grupo desliga dos outros membros antes e passa o posto de dono', async () => {
      await entrarComAmigos('ana', 'bia');
      const g = social.grupos()[0];
      expect(await social.sairDoGrupo(g)).toBeTrue();
      expect(api.chamadas).toEqual(['desligar ana_eu g1', 'desligar bia_eu g1', 'sair g1 eu ana']);
      expect(social.grupos()).toEqual([]);
    });

    it('quem não é dono sai sem trocar o dono', async () => {
      cloud.social.set({ uid: 'eu', api, nuvem });
      await assentar();
      api.conexoes?.cb([{ id: 'ana_eu', membros: ['ana', 'eu'], grupos: ['g1'] }]);
      api.grupos?.cb([grupoDe({ id: 'g1', membros: ['ana', 'eu'] })]);
      await assentar();
      await social.sairDoGrupo(social.grupos()[0]);
      expect(api.chamadas).toContain('sair g1 eu');
    });

    it('a timeline de um grupo só tem treinos de quem está nele', async () => {
      cloud.social.set({ uid: 'eu', api, nuvem });
      await assentar();
      api.grupos?.cb([grupoDe({ id: 'g1', dono: 'eu', membros: ['ana', 'eu'] }), grupoDe({ id: 'g2', dono: 'eu', membros: ['bia', 'eu'] })]);
      api.conexoes?.cb([
        { id: 'ana_eu', membros: ['ana', 'eu'], grupos: ['g1'] },
        { id: 'bia_eu', membros: ['bia', 'eu'], grupos: ['g2'] },
      ]);
      await assentar();
      api.eventos.get('ana')?.cb([evento('ana', 1000)]);
      api.eventos.get('bia')?.cb([evento('bia', 2000)]);
      await assentar();
      expect(social.timelineDe('g1').map((i) => i.criadoEm)).toEqual([1000]);
      expect(social.timelineDe('g2').map((i) => i.criadoEm)).toEqual([2000]);
    });

    it('o dono responde pedidos e muda quem pode participar', async () => {
      await entrarComAmigos();
      const g = grupoDe({ dono: 'eu', membros: ['eu'], acesso: 'aprovado', pedidos: ['bia'] });
      await social.responderPedido(g, 'bia', true);
      await social.definirAcesso(g, 'aberto');
      expect(api.chamadas).toEqual(['responder ABCD2345 bia true', 'acesso ABCD2345 aberto']);
    });
  });
});
