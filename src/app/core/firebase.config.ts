import type { FirebaseOptions } from 'firebase/app';

/**
 * Configuração do projeto Firebase (Console do Firebase → Configurações do projeto → Seus apps → Web).
 * Esses valores identificam o projeto e podem ficar no código público; quem protege os dados são
 * as regras do Firestore (arquivo `firestore.rules`). Enquanto estiver `null`, o login fica
 * desativado e o app funciona só com os dados do aparelho. Veja o README.
 */
export const FIREBASE_CONFIG: FirebaseOptions | null = {
  apiKey: "AIzaSyDHFCHnaOznyxuFGyjJ0TJ7mLKXjv7oVnk",
  authDomain: "app-workout-1f96f.firebaseapp.com",
  projectId: "app-workout-1f96f",
  storageBucket: "app-workout-1f96f.firebasestorage.app",
  messagingSenderId: "467681531845",
  appId: "1:467681531845:web:6be0a610da0b0d52769dac"
};;
