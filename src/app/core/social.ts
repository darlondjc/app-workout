import { MedalhaDoTreino } from './medalhas';
import { Cancelar } from './sync';

/** Dados públicos de quem usa o app (visíveis para quem está em algum grupo com a pessoa). */
export interface Perfil {
  uid: string;
  nome: string;
  foto: string | null;
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

export type AcessoGrupo = 'aberto' | 'aprovado';

/** Quantas vagas aparecem na tela de convite (só visual: o grupo não tem limite). */
export const VAGAS_GRUPO = 6;

/** Grupo de treino. O id é o código do convite (8 letras e números). */
export interface Grupo {
  id: string;
  nome: string;
  dono: string;
  membros: string[];
  /** `aberto`: quem tem o link entra na hora. `aprovado`: quem tem o link pede para entrar e o dono aceita. */
  acesso: AcessoGrupo;
  /** Quem pediu para entrar e espera o dono aceitar. */
  pedidos: string[];
  /** Imagem do grupo, escolhida pelo dono (JPEG pequeno em data URL). */
  foto?: string | null;
  criadoEm: number;
}

/**
 * Ligação entre duas pessoas que estão juntas em pelo menos um grupo. É ela que dá a uma pessoa o direito de
 * ler os treinos da outra (as regras do Firestore não conseguem procurar "algum grupo em comum").
 */
export interface Conexao {
  id: string;
  membros: string[];
  /** Grupos que as duas pessoas têm em comum. */
  grupos: string[];
}

export const TAMANHO_NOME_GRUPO = 40;

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
  /** Medalhas que este treino fez subir de nível. */
  medalhas?: MedalhaDoTreino[];
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
  /** Grupos de que a pessoa faz parte. */
  ouvirGrupos(uid: string, cb: (g: Grupo[]) => void, erro: (e: unknown) => void): Cancelar;
  /** Qualquer pessoa logada que tenha o código consegue ver o grupo (nome e membros) antes de entrar. */
  lerGrupo(codigo: string): Promise<Grupo | null>;
  /** Cria o grupo; falso se o código já pertence a outro. */
  criarGrupo(grupo: Grupo): Promise<boolean>;
  entrarNoGrupo(codigo: string, uid: string): Promise<void>;
  pedirEntrada(codigo: string, uid: string): Promise<void>;
  /** O dono aceita (`aceitar`) ou recusa um pedido; quem pediu também pode cancelar o próprio. */
  responderPedido(codigo: string, uid: string, aceitar: boolean): Promise<void>;
  definirAcesso(codigo: string, acesso: AcessoGrupo): Promise<void>;
  /** Troca a imagem do grupo; `null` volta à inicial do nome. */
  definirFotoDoGrupo(codigo: string, foto: string | null): Promise<void>;
  /** Sai do grupo; se era o dono e há mais gente, `novoDono` assume. Sem ninguém, o grupo é apagado. */
  sairDoGrupo(codigo: string, uid: string, novoDono?: string): Promise<void>;
  ouvirConexoes(uid: string, cb: (c: Conexao[]) => void, erro: (e: unknown) => void): Cancelar;
  /** Garante que a ligação entre as duas pessoas inclui o grupo. */
  ligar(a: string, b: string, grupo: string): Promise<void>;
  /** Tira o grupo da ligação; sem grupos em comum, ela some. */
  desligar(a: string, b: string, grupo: string): Promise<void>;
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

/** Identificador da ligação: igual para os dois lados, em qualquer ordem. */
export function chaveConexao(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O, 0, I, 1 para não confundir

export function gerarCodigo(aleatorio: (n: number) => number = (n) => Math.floor(Math.random() * n)): string {
  return Array.from({ length: 8 }, () => ALFABETO[aleatorio(ALFABETO.length)]).join('');
}

export function normalizarCodigo(texto: string): string {
  return texto.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Link de convite: abre o app direto na entrada do grupo (`base` é o endereço do app, com a barra final). */
export function linkDoGrupo(base: string, codigo: string): string {
  return `${base.replace(/\/?$/, '/')}convite/${codigo}`;
}

/** Itens da timeline de um grupo: só o que é dos membros dele. */
export function timelineDoGrupo(itens: ItemTimeline[], membros: string[]): ItemTimeline[] {
  const m = new Set(membros);
  return itens.filter((i) => m.has(i.tipo === 'evento' ? i.evento.autor : i.atividade.autor));
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
