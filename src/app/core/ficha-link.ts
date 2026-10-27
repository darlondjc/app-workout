import { Ficha, ItemFicha } from './models';
import { NOTA_EXERCICIO_MAX, limparNota } from './notas';

/**
 * Ficha dentro de um link: os dados vão no próprio endereço (`/ficha-compartilhada?d=…`), sem servidor. Quem recebe vê
 * uma prévia e só então adiciona. Como o link pode vir de qualquer pessoa, tudo o que chega é validado e limitado.
 */

export interface TreinoCompartilhado {
  nome: string;
  itens: ItemFicha[];
}

export interface FichaCompartilhada {
  nome: string;
  treinos: TreinoCompartilhado[];
}

const VERSAO = 1;
const MAX_TREINOS = 12;
const MAX_ITENS = 40;
const MAX_NOME = 40;
/** Teto do texto já descomprimido: uma ficha grande de verdade tem poucos KB. */
const MAX_JSON = 60_000;
/** Teto do que vem no link, antes de descomprimir. */
const MAX_LINK = 20_000;
/** Acima disto o QR code fica denso demais para ler com facilidade; só o link é oferecido. */
export const MAX_LINK_PARA_QR = 1100;

const ID_VALIDO = /^[\w.-]{1,100}$/;

type ItemCompacto = [string, number, number, number, number, 0 | 1, string?];
interface Compacto {
  v: number;
  n: string;
  t: { n: string; i: ItemCompacto[] }[];
}

/** Monta a ficha a compartilhar a partir dos treinos dela (a ordem é a da ficha). */
export function fichaParaCompartilhar(nome: string, treinos: readonly Ficha[]): FichaCompartilhada {
  return { nome, treinos: treinos.map((t) => ({ nome: t.nome, itens: t.itens })) };
}

function compactar(f: FichaCompartilhada): string {
  const c: Compacto = {
    v: VERSAO,
    n: f.nome,
    t: f.treinos.map((t) => ({
      n: t.nome,
      i: t.itens.map((it) => {
        const min = it.unidade === 'min' ? 1 : 0;
        const item: ItemCompacto = [it.exerciseId, it.series, it.reps, it.carga, it.descanso, min];
        if (it.nota) item.push(it.nota);
        return item;
      }),
    })),
  };
  return JSON.stringify(c);
}

function paraBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(texto: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(texto)) return null;
  try {
    const bin = atob(texto.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

const temCompressao = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

async function ler(fluxo: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/**
 * Texto do parâmetro `d`: "z" + base64url do JSON comprimido (deflate), ou "j" + base64url do JSON puro quando o
 * navegador não sabe comprimir.
 */
export async function codificarFicha(f: FichaCompartilhada): Promise<string> {
  const bytes = new TextEncoder().encode(compactar(f));
  if (temCompressao()) {
    const comprimido = await ler(new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw')));
    return 'z' + paraBase64Url(comprimido);
  }
  return 'j' + paraBase64Url(bytes);
}

/** Lê o parâmetro `d`. Devolve `null` se estiver corrompido, grande demais ou sem nenhum exercício aproveitável. */
export async function decodificarFicha(texto: string | null | undefined): Promise<FichaCompartilhada | null> {
  if (!texto || texto.length < 2 || texto.length > MAX_LINK) return null;
  const bytes = deBase64Url(texto.slice(1));
  if (!bytes) return null;
  try {
    let json: string;
    if (texto[0] === 'z') {
      if (!temCompressao()) return null;
      const aberto = await lerComLimite(new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw')));
      if (!aberto) return null;
      json = new TextDecoder().decode(aberto);
    } else if (texto[0] === 'j') {
      json = new TextDecoder().decode(bytes);
    } else {
      return null;
    }
    if (json.length > MAX_JSON) return null;
    return validar(JSON.parse(json));
  } catch {
    return null;
  }
}

/** Descomprime parando no teto, para um link malicioso não encher a memória. */
async function lerComLimite(fluxo: ReadableStream<Uint8Array>): Promise<Uint8Array | null> {
  const leitor = fluxo.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.length;
    if (total > MAX_JSON * 4) {
      await leitor.cancel();
      return null;
    }
    partes.push(value);
  }
  const saida = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    saida.set(p, pos);
    pos += p.length;
  }
  return saida;
}

const nome = (v: unknown, padrao: string): string => {
  const t = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, MAX_NOME) : '';
  return t || padrao;
};

const numero = (v: unknown, min: number, max: number, padrao: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : padrao;
  return Math.min(max, Math.max(min, n));
};

/** Aceita só o formato conhecido; qualquer outra coisa vira `null`. Os números são limitados aos mesmos intervalos do editor. */
export function validar(bruto: unknown): FichaCompartilhada | null {
  if (typeof bruto !== 'object' || bruto === null) return null;
  const c = bruto as Partial<Compacto>;
  if (c.v !== VERSAO || !Array.isArray(c.t)) return null;
  const treinos: TreinoCompartilhado[] = [];
  for (const t of c.t.slice(0, MAX_TREINOS)) {
    if (typeof t !== 'object' || t === null || !Array.isArray((t as { i?: unknown }).i)) continue;
    const itens: ItemFicha[] = [];
    for (const it of (t as { i: unknown[] }).i.slice(0, MAX_ITENS)) {
      if (!Array.isArray(it) || typeof it[0] !== 'string' || !ID_VALIDO.test(it[0])) continue;
      const min = it[5] === 1;
      const item: ItemFicha = {
        exerciseId: it[0],
        series: Math.round(numero(it[1], 1, 20, 3)),
        reps: Math.round(numero(it[2], 1, 100, 10)),
        carga: Math.round(numero(it[3], 0, 1000, 0) * 2) / 2,
        descanso: Math.round(numero(it[4], 0, 600, 60)),
      };
      if (min) item.unidade = 'min';
      const nota = limparNota(typeof it[6] === 'string' ? it[6] : undefined, NOTA_EXERCICIO_MAX);
      if (nota) item.nota = nota;
      itens.push(item);
    }
    if (itens.length > 0) treinos.push({ nome: nome((t as { n?: unknown }).n, 'Treino'), itens });
  }
  if (treinos.length === 0) return null;
  return { nome: nome(c.n, 'Ficha compartilhada'), treinos };
}

/**
 * Tira o código de uma ficha de um texto colado: o link inteiro (de qualquer endereço do app) ou só o código.
 * Devolve `null` se não parecer um link de ficha.
 */
export function codigoDoTexto(texto: string): string | null {
  const t = texto.trim();
  if (!t) return null;
  let codigo = t;
  const m = /[?&#]d=([^&#\s]+)/.exec(t);
  if (m) codigo = m[1];
  else if (/[/:?]/.test(t)) return null;
  try {
    codigo = decodeURIComponent(codigo);
  } catch {
    return null;
  }
  return /^[zj][A-Za-z0-9_-]+$/.test(codigo) && codigo.length <= MAX_LINK ? codigo : null;
}

/** Link completo para a ficha; `base` é o endereço do app terminado em barra. */
export function linkDaFicha(base: string, codigo: string): string {
  return `${base}ficha-compartilhada?d=${codigo}`;
}
