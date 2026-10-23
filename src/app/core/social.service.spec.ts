import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CloudService } from './cloud.service';
import { ExerciseService } from './exercise.service';
import { Sessao } from './models';
import { PlanService } from './plan.service';
import { Amizade, Atividade, Comentario, Evento, Perfil, SocialBackend } from './social';
import { LIMITE_SESSOES_AMIGO, PAGINA_TIMELINE, SocialService } from './social.service';
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
  amizades?: Ouvinte<Amizade[]>;
  eventos = new Map<string, Ouvinte<Evento[]>>();
  perfis: Record<string, Perfil> = {};

  lerPerfil = (uid: string) => Promise.resolve(this.perfis[uid] ?? null);
  gravarPerfil = () => Promise.resolve();
  reservarCodigo = () => Promise.resolve(true);
  uidDoCodigo = () => Promise.resolve(null);
  pedirAmizade = () => Promise.resolve();
  aceitarAmizade = () => Promise.resolve();
  removerAmizade = () => Promise.resolve();
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

  ouvirAmizades(_uid: string, cb: (a: Amizade[]) => void, erro: (e: unknown) => void): () => void {
    const o = ouvinte(cb, erro);
    this.amizades = o;
    return () => (o.cancelado = true);
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

const amizade = (outro: string, status: Amizade['status'] = 'aceita'): Amizade => ({
  id: `eu_${outro}`,
  membros: ['eu', outro],
  de: 'eu',
  status,
  criadoEm: 1,
});

describe('SocialService', () => {
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

  /** Entra na conta e recebe a lista de amizades. */
  async function entrarComAmigos(...amigos: Amizade[]): Promise<void> {
    cloud.social.set({ uid: 'eu', api, nuvem });
    await assentar();
    api.amizades?.cb(amigos);
    await assentar();
  }

  beforeEach(() => {
    localStorage.clear();
    marcadas = [];
    api = new ApiFalsa();
    api.perfis['ana'] = { uid: 'ana', nome: 'Ana', foto: null };
    nuvem = new NuvemFalsa();
    cloud = { social: signal<{ uid: string; api: SocialBackend; nuvem: NuvemBackend } | null>(null), usuario: signal({ uid: 'eu', nome: 'Eu', email: 'eu@x.com', foto: null }) };
    TestBed.configureTestingModule({
      providers: [
        { provide: CloudService, useValue: cloud },
        { provide: PlanService, useValue: { historico: signal<Sessao[]>([]), get: () => undefined, marcarFoto: (id: string, tem: boolean) => marcadas.push({ id, tem }) } },
        { provide: ExerciseService, useValue: { get: () => undefined, nome: () => '' } },
      ],
    });
    social = TestBed.inject(SocialService);
  });

  it('ao entrar, cria o perfil e passa a ouvir as amizades', async () => {
    cloud.social.set({ uid: 'eu', api, nuvem });
    await assentar();
    expect(social.eu()?.uid).toBe('eu');
    expect(social.eu()?.codigo).toMatch(/^[A-Z2-9]{8}$/);
    expect(api.amizades).toBeDefined();
  });

  it('acompanha os treinos publicados de cada amigo e os próprios', async () => {
    await entrarComAmigos(amizade('ana'));
    expect([...api.eventos.keys()].sort()).toEqual(['ana', 'eu']);
    expect(social.amigos().map((p) => p.perfil.nome)).toEqual(['Ana']);
  });

  it('convite pendente ainda não dá acesso: ninguém é ouvido', async () => {
    await entrarComAmigos(amizade('ana', 'pendente'));
    expect([...api.eventos.keys()]).toEqual(['eu']);
    expect(social.amigos().length).toBe(0);
    expect(social.convitesEnviados().length).toBe(1);
  });

  describe('estatísticas de amigos', () => {
    it('lê só os treinos mais recentes do amigo', async () => {
      await entrarComAmigos(amizade('ana'));
      social.sessoesDe('ana');
      expect(nuvem.sessoes.get('ana')?.limite).toBe(LIMITE_SESSOES_AMIGO);
    });

    it('abre uma única leitura por amigo, mesmo consultando várias vezes', async () => {
      await entrarComAmigos(amizade('ana'));
      const abrir = spyOn(nuvem, 'ouvirSessoes').and.callThrough();
      social.sessoesDe('ana');
      social.sessoesDe('ana');
      expect(abrir).toHaveBeenCalledTimes(1);
    });

    it('os próprios treinos não passam por aqui', async () => {
      await entrarComAmigos(amizade('ana'));
      social.sessoesDe('eu');
      expect(nuvem.sessoes.has('eu')).toBeFalse();
    });
  });

  describe('quando a amizade acaba', () => {
    it('para de ouvir os treinos publicados e o histórico do ex-amigo', async () => {
      await entrarComAmigos(amizade('ana'));
      social.sessoesDe('ana');
      nuvem.sessoes.get('ana')?.cb([{ id: 's1', data: '2026-10-20', fichaId: 'f1' }]);
      expect(social.sessoesCarregadas('ana')).toBeTrue();

      api.amizades?.cb([]);
      await assentar();

      expect(api.eventos.get('ana')?.cancelado).toBeTrue();
      expect(nuvem.sessoes.get('ana')?.cancelado).toBeTrue();
      expect(social.sessoesCarregadas('ana')).toBeFalse();
      expect(api.eventos.get('eu')?.cancelado).toBeFalse();
    });

    it('se voltarem a ser amigos, volta a ouvir', async () => {
      await entrarComAmigos(amizade('ana'));
      social.sessoesDe('ana');
      api.amizades?.cb([]);
      await assentar();
      api.amizades?.cb([amizade('ana')]);
      await assentar();
      social.sessoesDe('ana');
      expect(api.eventos.get('ana')?.cancelado).toBeFalse();
      expect(nuvem.sessoes.get('ana')?.cancelado).toBeFalse();
    });

    it('"sem permissão" de um amigo que nos tirou da lista não vira aviso na tela', async () => {
      await entrarComAmigos(amizade('ana'));
      social.sessoesDe('ana');

      api.eventos.get('ana')?.erro({ code: 'permission-denied' });
      nuvem.sessoes.get('ana')?.erro({ code: 'permission-denied' });

      expect(social.erro()).toBe('');
      expect(api.eventos.get('ana')?.cancelado).toBeTrue();
      expect(nuvem.sessoes.get('ana')?.cancelado).toBeTrue();
    });
  });

  describe('erros', () => {
    it('"sem permissão" nos próprios dados pede para publicar as regras do Firestore', async () => {
      await entrarComAmigos(amizade('ana'));
      api.eventos.get('eu')?.erro({ code: 'permission-denied' });
      expect(social.erro()).toContain('Publique as regras');
    });

    it('outro erro ao ouvir um amigo continua avisando', async () => {
      await entrarComAmigos(amizade('ana'));
      api.eventos.get('ana')?.erro({ code: 'unavailable' });
      expect(social.erro()).toContain('Não foi possível falar com o servidor');
    });

    describe('curtidas e comentários de um treino', () => {
      it('"sem permissão" nas reações de um treino seu pede para publicar as regras', async () => {
        await entrarComAmigos(amizade('ana'));
        social.ouvirCurtidas('eu', 'e1', () => undefined);
        social.ouvirComentarios('eu', 'e1', () => undefined);
        api.curtidas.get('eu/e1')?.erro({ code: 'permission-denied' });
        expect(social.erro()).toContain('Publique as regras');
      });

      it('o erro ao ler os comentários também aparece (não vira "sem comentários")', async () => {
        await entrarComAmigos(amizade('ana'));
        const recebeu = jasmine.createSpy('recebeu');
        social.ouvirComentarios('ana', 'e1', recebeu);
        api.comentarios.get('ana/e1')?.erro({ code: 'unavailable' });
        expect(social.erro()).toContain('Não foi possível falar com o servidor');
        expect(recebeu).not.toHaveBeenCalled();
      });

      it('"sem permissão" nas reações de um ex-amigo não vira aviso e solta a pessoa', async () => {
        await entrarComAmigos(amizade('ana'));
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
      await entrarComAmigos(amizade('ana'));
      expect(social.nomeDe('ana', 'Ana Antiga')).toBe('Ana Nova');
      expect(social.fotoDe('ana', 'velha.png')).toBe('nova.png');
    });

    it('quem tirou a foto aparece sem foto, não com a antiga', async () => {
      api.perfis['ana'] = { uid: 'ana', nome: 'Ana', foto: null };
      await entrarComAmigos(amizade('ana'));
      expect(social.fotoDe('ana', 'velha.png')).toBeNull();
    });

    it('o próprio perfil vem direto, sem busca', async () => {
      await entrarComAmigos();
      const ler = spyOn(api, 'lerPerfil').and.callThrough();
      expect(social.nomeDe('eu', 'nome antigo')).toBe('Eu');
      expect(ler).not.toHaveBeenCalled();
    });

    it('de quem não é amigo, usa o gravado e busca o perfil em segundo plano', async () => {
      api.perfis['bia'] = { uid: 'bia', nome: 'Bia Atual', foto: null };
      await entrarComAmigos(amizade('ana'));
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
      spyOn(api, 'lerPerfil').and.callFake((uid: string) => (falhar ? Promise.reject(new Error('sem rede')) : Promise.resolve(api.perfis[uid] ?? null)));

      api.amizades?.cb([amizade('ana')]);
      await assentar();
      expect(social.amigos()[0].perfil.nome).toBe('Amigo');

      falhar = false;
      api.amizades?.cb([amizade('ana')]);
      await assentar();
      expect(social.amigos()[0].perfil.nome).toBe('Ana');
    });

    it('sem conta, devolve o gravado e não busca nada', () => {
      const ler = spyOn(api, 'lerPerfil').and.callThrough();
      expect(social.nomeDe('ana', 'Ana Gravada')).toBe('Ana Gravada');
      expect(social.fotoDe('ana', 'foto.png')).toBe('foto.png');
      expect(ler).not.toHaveBeenCalled();
    });
  });

  it('ao sair da conta, para tudo e limpa os dados', async () => {
    await entrarComAmigos(amizade('ana'));
    social.sessoesDe('ana');

    cloud.social.set(null);
    await assentar();

    expect(api.amizades?.cancelado).toBeTrue();
    expect(api.eventos.get('ana')?.cancelado).toBeTrue();
    expect(api.eventos.get('eu')?.cancelado).toBeTrue();
    expect(nuvem.sessoes.get('ana')?.cancelado).toBeTrue();
    expect(social.eu()).toBeNull();
    expect(social.amigos()).toEqual([]);
  });
  describe('novidades na timeline', () => {
    const futuro = () => Date.now() + 60_000;

    it('um treino novo de amigo vira novidade e some quando a timeline é vista', async () => {
      await entrarComAmigos(amizade('ana'));
      expect(social.novidades()).toBe(0);
      api.eventos.get('ana')?.cb([evento('ana', futuro())]);
      await assentar();
      expect(social.novidades()).toBe(1);
      social.marcarTimelineVista();
      expect(social.novidades()).toBe(0);
    });

    it('o que já existia antes da primeira entrada não conta como novidade', async () => {
      await entrarComAmigos(amizade('ana'));
      api.eventos.get('ana')?.cb([evento('ana', 1000)]);
      await assentar();
      expect(social.novidades()).toBe(0);
    });

    it('convites de amizade recebidos entram no aviso da aba e saem quando respondidos', async () => {
      await entrarComAmigos({ ...amizade('bia', 'pendente'), id: 'bia_eu', de: 'bia' });
      expect(social.novidades()).toBe(0);
      expect(social.avisosDaAba()).toBe(1);
      api.amizades?.cb([]);
      await assentar();
      expect(social.avisosDaAba()).toBe(0);
    });

    it('convite que eu enviei não conta como aviso', async () => {
      await entrarComAmigos(amizade('bia', 'pendente'));
      expect(social.avisosDaAba()).toBe(0);
    });

    it('os próprios treinos não contam', async () => {
      await entrarComAmigos(amizade('ana'));
      api.eventos.get('eu')?.cb([evento('eu', futuro())]);
      await assentar();
      expect(social.novidades()).toBe(0);
    });

    it('curtidas e comentários de amigos também contam', async () => {
      await entrarComAmigos(amizade('ana'));
      api.atividadesCb?.([{ id: 'a1', autor: 'ana', autorNome: 'Ana', autorFoto: null, tipo: 'curtida', eventoId: 'e1', criadoEm: futuro() }]);
      await assentar();
      expect(social.novidades()).toBe(1);
    });

    it('guarda até onde foi visto, por conta, para não avisar de novo ao reabrir o app', async () => {
      await entrarComAmigos(amizade('ana'));
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
      await entrarComAmigos(amizade('ana'));
      api.eventos.get('ana')?.cb(lote('ana', 15));
      await assentar();
      expect(social.timeline().length).toBe(15);
      expect(social.timelineVisivel().length).toBe(PAGINA_TIMELINE);
      expect(social.timelineVisivel()[0].criadoEm).toBe(1014); // do mais novo para o mais antigo
      expect(social.temMais()).toBeTrue();

      social.carregarMais();
      expect(social.timelineVisivel().length).toBe(15);
    });

    it('já lido e escondido não abre nova leitura na nuvem', async () => {
      await entrarComAmigos(amizade('ana'), amizade('bia'));
      api.eventos.get('ana')?.cb(lote('ana', 14));
      api.eventos.get('bia')?.cb(lote('bia', 14, 2000)); // 28 lidos, nenhuma leitura cheia
      await assentar();
      expect(social.timelineVisivel().length).toBe(PAGINA_TIMELINE);
      const aberto = api.eventos.get('ana');
      social.carregarMais(); // 20 de 28: já está lido
      expect(social.timelineVisivel().length).toBe(20);
      expect(api.eventos.get('ana')).toBe(aberto);
      expect(aberto?.cancelado).toBeFalse();
    });

    it('leitura que veio cheia pede mais à nuvem quando a tela alcança o fim', async () => {
      await entrarComAmigos(amizade('ana'));
      const primeiro = api.eventos.get('ana')!;
      expect(primeiro.limite).toBe(15);
      primeiro.cb(lote('ana', 15)); // veio no limite: pode haver mais
      await assentar();
      social.carregarMais(); // mostra 15 (tudo o que foi lido)
      social.carregarMais(); // quer 20, só há 15 -> abre leitura maior
      const segundo = api.eventos.get('ana')!;
      expect(primeiro.cancelado).toBeTrue();
      expect(segundo).not.toBe(primeiro);
      expect(segundo.limite).toBe(30);
      expect(api.limiteAtividades).toBe(60);
      // o que já chegou continua na tela até o novo resultado
      expect(social.timeline().length).toBe(15);
    });

    it('leitura parcial é o fim: some o "tem mais" e nada novo é pedido', async () => {
      await entrarComAmigos(amizade('ana'));
      api.eventos.get('ana')?.cb(lote('ana', 12));
      await assentar();
      social.carregarMais();
      expect(social.timelineVisivel().length).toBe(12);
      expect(social.temMais()).toBeFalse();
      const aberto = api.eventos.get('ana');
      social.carregarMais();
      expect(api.eventos.get('ana')).toBe(aberto);
    });

    it('novos itens depois da leitura ampliada entram na lista', async () => {
      await entrarComAmigos(amizade('ana'));
      api.eventos.get('ana')?.cb(lote('ana', 15));
      await assentar();
      social.carregarMais();
      social.carregarMais();
      api.eventos.get('ana')?.cb(lote('ana', 22)); // agora a nuvem devolveu 22 (< 30): fim
      await assentar();
      expect(social.timeline().length).toBe(22);
      expect(social.temMais()).toBeTrue(); // ainda há 2 fora da tela (20 de 22)
      social.carregarMais();
      expect(social.timelineVisivel().length).toBe(22);
      expect(social.temMais()).toBeFalse();
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
      await entrarComAmigos(amizade('ana'));
      api.fotos.set('ana/sx', 'data:image/jpeg;base64,BBB');
      const [a, b] = await Promise.all([social.lerFoto('ana', 'sx'), social.lerFoto('ana', 'sx')]);
      expect(a).toBe('data:image/jpeg;base64,BBB');
      expect(b).toBe(a);
      expect(api.leiturasDeFoto).toBe(1);
    });

    it('treino sem foto devolve null, e uma falha de leitura não fica guardada', async () => {
      await entrarComAmigos(amizade('ana'));
      expect(await social.lerFoto('ana', 'nada')).toBeNull();
      api.falhaFoto = { code: 'unavailable' };
      expect(await social.lerFoto('ana', 'sy')).toBeNull();
      api.falhaFoto = undefined;
      api.fotos.set('ana/sy', 'data:image/jpeg;base64,CCC');
      expect(await social.lerFoto('ana', 'sy')).toBe('data:image/jpeg;base64,CCC');
    });

    it('foto que não pode ser lida (ex.: regra ainda não publicada) não derruba o amigo nem mostra erro', async () => {
      spyOn(console, 'warn');
      await entrarComAmigos(amizade('ana'));
      api.eventos.get('ana')?.cb([evento('ana', 7)]);
      await assentar();
      api.falhaFoto = { code: 'permission-denied' };
      expect(await social.lerFoto('ana', 'sz')).toBeNull();
      await assentar();
      expect(social.amigos().length).toBe(1);
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
      await entrarComAmigos(amizade('ana'));
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
});
