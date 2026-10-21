import type { FirebaseOptions } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { FirebaseSocial } from './firebase.social';
import { Sessao } from './models';
import { Cancelar, DocEstado, NuvemBackend, Usuario } from './sync';

interface Fb {
  auth: typeof import('firebase/auth');
  fs: typeof import('firebase/firestore');
}

/** Remove `undefined` e deixa só dados simples, que o Firestore aceita. */
const limpo = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Firebase carregado sob demanda (fica fora do pacote inicial). */
export class FirebaseBackend implements NuvemBackend {
  private constructor(
    private readonly m: Fb,
    private readonly auth: Auth,
    private readonly db: Firestore,
  ) {}

  static async criar(config: FirebaseOptions): Promise<FirebaseBackend> {
    const [app, auth, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
    const instancia = app.getApps()[0] ?? app.initializeApp(config);
    const db = fs.initializeFirestore(instancia, {
      // Cache no aparelho: funciona sem internet e envia as gravações quando voltar a conexão.
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
    return new FirebaseBackend({ auth, fs }, auth.getAuth(instancia), db);
  }

  /** Parte social (amigos, timeline, curtidas e comentários) sobre o mesmo banco. */
  social(): FirebaseSocial {
    return new FirebaseSocial(this.m.fs, this.db);
  }

  aoMudarUsuario(cb: (u: Usuario | null) => void, erro: (e: unknown) => void): Cancelar {
    // Conclui um login por redirecionamento, se houver (alguns navegadores bloqueiam o popup).
    void this.m.auth.getRedirectResult(this.auth).catch(erro);
    return this.m.auth.onAuthStateChanged(this.auth, (u) =>
      cb(u ? { uid: u.uid, nome: u.displayName ?? '', email: u.email ?? '', foto: u.photoURL } : null),
    );
  }

  async entrar(): Promise<void> {
    const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = this.m.auth;
    const provedor = new GoogleAuthProvider();
    try {
      await signInWithPopup(this.auth, provedor);
    } catch (e) {
      const codigo = (e as { code?: string }).code;
      if (codigo === 'auth/popup-blocked' || codigo === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(this.auth, provedor);
        return;
      }
      throw e;
    }
  }

  sair(): Promise<void> {
    return this.m.auth.signOut(this.auth);
  }

  ouvirEstado(uid: string, cb: (doc: DocEstado | null, pendente: boolean) => void, erro: (e: unknown) => void): Cancelar {
    const { doc, onSnapshot } = this.m.fs;
    return onSnapshot(
      doc(this.db, 'usuarios', uid),
      (snap) => cb(snap.exists() ? (snap.data() as DocEstado) : null, snap.metadata.hasPendingWrites),
      erro,
    );
  }

  gravarEstado(uid: string, dados: DocEstado): Promise<void> {
    const { doc, setDoc } = this.m.fs;
    return setDoc(doc(this.db, 'usuarios', uid), limpo(dados));
  }

  ouvirSessoes(uid: string, cb: (s: Sessao[]) => void, erro: (e: unknown) => void, limite?: number): Cancelar {
    const { collection, onSnapshot, query, orderBy, limit } = this.m.fs;
    const sessoes = collection(this.db, 'usuarios', uid, 'sessoes');
    return onSnapshot(
      limite ? query(sessoes, orderBy('data', 'desc'), limit(limite)) : sessoes,
      (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Sessao), id: d.id }))),
      erro,
    );
  }

  gravarSessao(uid: string, sessao: Sessao): Promise<void> {
    const { doc, setDoc } = this.m.fs;
    return setDoc(doc(this.db, 'usuarios', uid, 'sessoes', sessao.id as string), limpo(sessao));
  }

  aguardarGravacoes(): Promise<void> {
    return this.m.fs.waitForPendingWrites(this.db);
  }
}
