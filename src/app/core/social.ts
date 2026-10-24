import { Cancelar } from './sync';

/** Dados públicos de quem usa o app (visíveis para quem tem a pessoa como amiga ou o código). */
export interface Perfil {
  uid: string;
  nome: string;
  foto: string | null;
  /** Código para ser adicionado por amigos. */
  codigo?: string;
  metaSemanal?: number;
  /** A foto foi escolhida no app (e não veio da conta Google); o login não a troca mais. */
  fotoPropria?: boolean;
}

/**
 * Foto gravada junto de treinos, comentários e avisos. Foto escolhida no app é um texto grande demais para repetir
 * em cada item: fica só no perfil e quem lê busca a atual com `fotoDe`.
 */
export function fotoParaItens(p: Perfil): string | null {
  return p.fotoPropria ? null : p.foto;
}

export interface Amizade {
  id: string;
  membros: string[];
  /** Quem enviou o convite. */
  de: string;
  status: 'pendente' | 'aceita';
  criadoEm: number;
}

/** Treino concluído, publicado na timeline dos amigos. */
export interface Evento {
  id: string;
  autor: string;
  autorNome: string;
  autorFoto: string | null;
  tipo: 'treino';
  criadoEm: number;
  sessaoId: string;
  data: string;
  fichaNome: string;
  exercicios: number;
  volume: number;
  recordes: { nome: string; carga: number }[];
  /** Resumo da atividade (ex.: "5,2 km · 31 min"), quando o evento é uma atividade fora da ficha; `fichaNome` traz o nome dela. */
  detalhe?: string;
  /** Ex.: "50º treino", quando o total de treinos chega a um marco. */
  marco?: string;
  /** Há uma foto deste treino em `usuarios/{autor}/fotos/{sessaoId}`; ela é lida só quando o card aparece. */
  temFoto?: boolean;
}

/** Curtida ou comentário feito por um amigo em um treino seu. Só o dono do treino lê. */
export interface Atividade {
  id: string;
  autor: string;
  autorNome: string;
  autorFoto: string | null;
  tipo: 'curtida' | 'comentario';
  eventoId: string;
  texto?: string;
  criadoEm: number;
}

export interface Comentario {
  id: string;
  autor: string;
  autorNome: string;
  autorFoto: string | null;
  texto: string;
  criadoEm: number;
}

/** Item da timeline: o treino de alguém ou uma reação ao seu treino. */
export type ItemTimeline =
  | { tipo: 'evento'; chave: string; criadoEm: number; evento: Evento }
  | { tipo: 'atividade'; chave: string; criadoEm: number; atividade: Atividade };

/** Nome de pessoa começando com letra maiúscula ("ana lima" → "Ana lima"). */
export function nomeComMaiuscula(nome: string): string {
  const n = nome.trim();
  return n.charAt(0).toLocaleUpperCase('pt-BR') + n.slice(1);
}

export const TAMANHO_COMENTARIO = 280;

/** O que o app precisa da nuvem para a parte social (a implementação real usa Firebase). */
export interface SocialBackend {
  lerPerfil(uid: string): Promise<Perfil | null>;
  gravarPerfil(perfil: Perfil): Promise<void>;
  /** Tenta reservar o código; falso se já pertence a outra pessoa. */
  reservarCodigo(uid: string, codigo: string): Promise<boolean>;
  uidDoCodigo(codigo: string): Promise<string | null>;
  ouvirAmizades(uid: string, cb: (a: Amizade[]) => void, erro: (e: unknown) => void): Cancelar;
  pedirAmizade(amizade: Amizade): Promise<void>;
  aceitarAmizade(id: string): Promise<void>;
  removerAmizade(id: string): Promise<void>;
  ouvirEventos(uid: string, cb: (e: Evento[]) => void, erro: (e: unknown) => void, limite?: number): Cancelar;
  publicarEvento(evento: Evento): Promise<void>;
  /** Foto do treino, como data URL JPEG já reduzida, guardada à parte do card. */
  gravarFoto(uid: string, sessaoId: string, dados: string): Promise<void>;
  apagarFoto(uid: string, sessaoId: string): Promise<void>;
  lerFoto(uid: string, sessaoId: string): Promise<string | null>;
  /** Liga ou desliga o aviso de foto num card já publicado. */
  marcarFotoEvento(uid: string, eventoId: string, tem: boolean): Promise<void>;
  ouvirAtividades(uid: string, cb: (a: Atividade[]) => void, erro: (e: unknown) => void, limite?: number): Cancelar;
  ouvirCurtidas(dono: string, eventoId: string, cb: (uids: string[]) => void, erro: (e: unknown) => void): Cancelar;
  ouvirComentarios(dono: string, eventoId: string, cb: (c: Comentario[]) => void, erro: (e: unknown) => void): Cancelar;
  curtir(dono: string, eventoId: string, eu: Perfil): Promise<void>;
  descurtir(dono: string, eventoId: string, euUid: string): Promise<void>;
  comentar(dono: string, eventoId: string, eu: Perfil, texto: string): Promise<void>;
  apagarComentario(dono: string, eventoId: string, comentarioId: string): Promise<void>;
}

/** Identificador da amizade: igual para os dois lados, em qualquer ordem. */
export function chaveAmizade(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O, 0, I, 1 para não confundir

export function gerarCodigo(aleatorio: (n: number) => number = (n) => Math.floor(Math.random() * n)): string {
  return Array.from({ length: 8 }, () => ALFABETO[aleatorio(ALFABETO.length)]).join('');
}

export function normalizarCodigo(texto: string): string {
  return texto.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Id do treino na timeline: o tempo vem primeiro, então a ordem alfabética é a cronológica,
 * e o mesmo treino sempre gera o mesmo id (publicar duas vezes não duplica).
 */
export function idEvento(criadoEm: number, sessaoId: string): string {
  return `${String(criadoEm).padStart(13, '0')}_${sessaoId}`;
}

/** Junta treinos e reações, do mais novo para o mais antigo. */
export function montarTimeline(eventos: Evento[], atividades: Atividade[], limite = Infinity): ItemTimeline[] {
  const itens: ItemTimeline[] = [
    ...eventos.map((e): ItemTimeline => ({ tipo: 'evento', chave: `e:${e.autor}:${e.id}`, criadoEm: e.criadoEm, evento: e })),
    ...atividades.map((a): ItemTimeline => ({ tipo: 'atividade', chave: `a:${a.id}`, criadoEm: a.criadoEm, atividade: a })),
  ];
  return itens.sort((x, y) => y.criadoEm - x.criadoEm).slice(0, limite);
}

const MARCOS = [10, 25, 50, 100, 200, 365, 500, 1000];

/** Texto de marco se este treino levou o total a um número redondo. */
export function marcoDoTreino(totalDeTreinos: number): string | undefined {
  return MARCOS.includes(totalDeTreinos) ? `${totalDeTreinos}º treino` : undefined;
}

export function tempoRelativo(criadoEm: number, agora: number): string {
  const s = Math.max(0, Math.round((agora - criadoEm) / 1000));
  if (s < 60) return 'agora';
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} ${d === 1 ? 'dia' : 'dias'}`;
  return new Date(criadoEm).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}
