import type { FirebaseOptions } from 'firebase/app';

/**
 * Configuração do projeto Firebase (Console do Firebase → Configurações do projeto → Seus apps → Web).
 * Esses valores identificam o projeto e podem ficar no código público; quem protege os dados são
 * as regras do Firestore (arquivo `firestore.rules`). Enquanto estiver `null`, o login fica
 * desativado e o app funciona só com os dados do aparelho. Veja o README.
 */
export const FIREBASE_CONFIG: FirebaseOptions | null = null;
