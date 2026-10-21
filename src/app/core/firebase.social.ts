import type { Firestore } from 'firebase/firestore';
import { Amizade, Atividade, Comentario, Evento, Perfil, SocialBackend, TAMANHO_COMENTARIO, nomeComMaiuscula } from './social';
import { Cancelar } from './sync';

type Fs = typeof import('firebase/firestore');

const limpo = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Id fixo por pessoa e treino: curtir, descurtir e curtir de novo atualiza o mesmo aviso, sem empilhar. */
export function idAvisoCurtida(eventoId: string, autorUid: string): string {
  return `curtida_${eventoId}_${autorUid}`.slice(0, 200);
}

/** Parte social sobre o mesmo Firestore do login e do backup. */
export class FirebaseSocial implements SocialBackend {
  constructor(
    private readonly fs: Fs,
    private readonly db: Firestore,
  ) {}

  private usuario(uid: string, ...resto: string[]) {
    return this.fs.doc(this.db, 'usuarios', uid, ...(resto as [string, ...string[]]));
  }

  private eventoRef(dono: string, eventoId: string) {
    return this.fs.doc(this.db, 'usuarios', dono, 'eventos', eventoId);
  }

  async lerPerfil(uid: string): Promise<Perfil | null> {
    const snap = await this.fs.getDoc(this.fs.doc(this.db, 'perfis', uid));
    if (!snap.exists()) return null;
    const p = snap.data() as Perfil;
    return { ...p, uid, nome: nomeComMaiuscula(p.nome ?? '') };
  }

  gravarPerfil(p: Perfil): Promise<void> {
    const { uid, ...dados } = p;
    return this.fs.setDoc(this.fs.doc(this.db, 'perfis', uid), limpo({ ...dados, atualizadoEm: Date.now() }), { merge: true });
  }

  async reservarCodigo(uid: string, codigo: string): Promise<boolean> {
    try {
      await this.fs.setDoc(this.fs.doc(this.db, 'codigos', codigo), { uid });
      return true;
    } catch (e) {
      if ((e as { code?: string }).code === 'permission-denied') return false; // já existe: as regras não deixam sobrescrever
      throw e;
    }
  }

  async uidDoCodigo(codigo: string): Promise<string | null> {
    const snap = await this.fs.getDoc(this.fs.doc(this.db, 'codigos', codigo));
    return snap.exists() ? ((snap.data() as { uid: string }).uid ?? null) : null;
  }

  ouvirAmizades(uid: string, cb: (a: Amizade[]) => void, erro: (e: unknown) => void): Cancelar {
    const { query, collection, where, onSnapshot } = this.fs;
    return onSnapshot(
      query(collection(this.db, 'amizades'), where('membros', 'array-contains', uid)),
      (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Amizade), id: d.id }))),
      erro,
    );
  }

  pedirAmizade(a: Amizade): Promise<void> {
    const { id, ...dados } = a;
    return this.fs.setDoc(this.fs.doc(this.db, 'amizades', id), limpo(dados));
  }

  aceitarAmizade(id: string): Promise<void> {
    return this.fs.updateDoc(this.fs.doc(this.db, 'amizades', id), { status: 'aceita' });
  }

  removerAmizade(id: string): Promise<void> {
    return this.fs.deleteDoc(this.fs.doc(this.db, 'amizades', id));
  }

  ouvirEventos(uid: string, cb: (e: Evento[]) => void, erro: (e: unknown) => void): Cancelar {
    const { query, collection, orderBy, documentId, limit, onSnapshot } = this.fs;
    return onSnapshot(
      query(collection(this.db, 'usuarios', uid, 'eventos'), orderBy(documentId(), 'desc'), limit(15)),
      (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Evento), id: d.id }))),
      erro,
    );
  }

  publicarEvento(e: Evento): Promise<void> {
    const { id, ...dados } = e;
    return this.fs.setDoc(this.eventoRef(e.autor, id), limpo(dados));
  }

  ouvirAtividades(uid: string, cb: (a: Atividade[]) => void, erro: (e: unknown) => void): Cancelar {
    const { query, collection, orderBy, limit, onSnapshot } = this.fs;
    // Por `criadoEm` (e não pelo id): o aviso de curtida tem id fixo, sem o horário na frente.
    return onSnapshot(
      query(collection(this.db, 'usuarios', uid, 'atividades'), orderBy('criadoEm', 'desc'), limit(30)),
      (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Atividade), id: d.id }))),
      erro,
    );
  }

  ouvirCurtidas(dono: string, eventoId: string, cb: (uids: string[]) => void, erro: (e: unknown) => void): Cancelar {
    return this.fs.onSnapshot(
      this.fs.collection(this.db, 'usuarios', dono, 'eventos', eventoId, 'curtidas'),
      (snap) => cb(snap.docs.map((d) => d.id)),
      erro,
    );
  }

  ouvirComentarios(dono: string, eventoId: string, cb: (c: Comentario[]) => void, erro: (e: unknown) => void): Cancelar {
    const { query, collection, orderBy, onSnapshot } = this.fs;
    return onSnapshot(
      query(collection(this.db, 'usuarios', dono, 'eventos', eventoId, 'comentarios'), orderBy('criadoEm', 'asc')),
      (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Comentario), id: d.id }))),
      erro,
    );
  }

  /** Avisa o dono do treino (a menos que seja a própria pessoa). Com id fixo, repetir o aviso o sobrescreve. */
  private avisar(dono: string, id: string, eu: Perfil, eventoId: string, tipo: Atividade['tipo'], texto?: string): Promise<void> {
    if (dono === eu.uid) return Promise.resolve();
    const dados = limpo({ autor: eu.uid, autorNome: eu.nome, autorFoto: eu.foto, tipo, eventoId, texto, criadoEm: Date.now() });
    return this.fs.setDoc(this.usuario(dono, 'atividades', id), dados);
  }

  async curtir(dono: string, eventoId: string, eu: Perfil): Promise<void> {
    await this.fs.setDoc(this.fs.doc(this.db, 'usuarios', dono, 'eventos', eventoId, 'curtidas', eu.uid), { criadoEm: Date.now() });
    try {
      await this.avisar(dono, idAvisoCurtida(eventoId, eu.uid), eu, eventoId, 'curtida');
    } catch {
      // A curtida já foi registrada; o aviso ao dono é secundário e não deve virar erro na tela.
    }
  }

  descurtir(dono: string, eventoId: string, euUid: string): Promise<void> {
    return this.fs.deleteDoc(this.fs.doc(this.db, 'usuarios', dono, 'eventos', eventoId, 'curtidas', euUid));
  }

  async comentar(dono: string, eventoId: string, eu: Perfil, texto: string): Promise<void> {
    const t = texto.trim().slice(0, TAMANHO_COMENTARIO);
    if (!t) return;
    const agora = Date.now();
    const id = `${String(agora).padStart(13, '0')}_${eu.uid}`;
    await this.fs.setDoc(
      this.fs.doc(this.db, 'usuarios', dono, 'eventos', eventoId, 'comentarios', id),
      limpo({ autor: eu.uid, autorNome: eu.nome, autorFoto: eu.foto, texto: t, criadoEm: agora }),
    );
    await this.avisar(dono, `${id}_comentario_${eventoId}`.slice(0, 200), eu, eventoId, 'comentario', t);
  }

  apagarComentario(dono: string, eventoId: string, comentarioId: string): Promise<void> {
    return this.fs.deleteDoc(this.fs.doc(this.db, 'usuarios', dono, 'eventos', eventoId, 'comentarios', comentarioId));
  }
}
