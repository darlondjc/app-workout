import { Injectable, effect, inject, untracked } from '@angular/core';
import { CloudService } from './cloud.service';
import { ExerciseService } from './exercise.service';
import { EmAndamento, Ficha } from './models';
import { PlanService } from './plan.service';

const CHAVE_PRECARGA = 'app-workout:precarga:v1';

/** Exercícios das fichas (e os trocados só no treino em andamento), sem repetir. */
export function idsDasFichas(fichas: Ficha[], andamento: EmAndamento | null): string[] {
  const ids = new Set<string>();
  for (const f of fichas.filter((x) => !x.arquivada)) for (const i of f.itens) ids.add(i.exerciseId);
  for (const id of Object.values(andamento?.trocas ?? {})) ids.add(id);
  return [...ids];
}

/**
 * Baixa as imagens de cada exercício, poucas por vez. Devolve os exercícios em que todas as
 * imagens vieram: só esses podem ser considerados prontos para o uso sem internet.
 */
export async function baixarImagens(
  ids: string[],
  urlsDe: (id: string) => string[],
  buscar: (url: string) => Promise<Response> = (u) => fetch(u),
  paralelo = 3,
): Promise<string[]> {
  const prontos: string[] = [];
  const fila = [...ids];
  const trabalhador = async (): Promise<void> => {
    for (let id = fila.shift(); id !== undefined; id = fila.shift()) {
      try {
        const respostas = await Promise.all(urlsDe(id).map((u) => buscar(u)));
        if (respostas.every((r) => r.ok)) prontos.push(id);
      } catch {
        // sem rede ou imagem ausente: este exercício fica para a próxima vez
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(paralelo, ids.length) }, trabalhador));
  return prontos;
}

/**
 * Com internet, pede ao navegador as imagens dos exercícios das fichas. O service worker guarda o
 * que passa por ele, então o treino continua com fotos sem conexão (só vem do cache o que já foi baixado).
 */
@Injectable({ providedIn: 'root' })
export class PrecargaService {
  private readonly plans = inject(PlanService);
  private readonly ex = inject(ExerciseService);
  private readonly cloud = inject(CloudService);
  private readonly prontos = new Set<string>(ler());
  private rodando = false;

  constructor() {
    effect(() => {
      const online = this.cloud.online();
      const ids = idsDasFichas(this.plans.fichas(), this.plans.emAndamento());
      if (online && ids.length > 0) untracked(() => void this.precarregar(ids));
    });
  }

  private async precarregar(ids: string[]): Promise<void> {
    const faltam = ids.filter((id) => !this.prontos.has(id));
    if (this.rodando || faltam.length === 0 || !(await this.podeGuardar())) return;
    this.rodando = true;
    try {
      // Espera o app assentar para não disputar banda com o que a pessoa está abrindo.
      await new Promise((r) => setTimeout(r, 3000));
      const urlsDe = (id: string) => [this.ex.imagem(id, 0), this.ex.animacao(id)];
      for (const id of await baixarImagens(faltam, urlsDe)) this.prontos.add(id);
      salvar(this.prontos);
    } finally {
      this.rodando = false;
    }
  }

  /** Só vale baixar se o service worker já está no comando (senão nada fica guardado) e sem "economia de dados". */
  private async podeGuardar(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) return false;
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return false;
    try {
      await navigator.serviceWorker.ready;
    } catch {
      return false;
    }
    return !!navigator.serviceWorker.controller;
  }
}

function ler(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_PRECARGA) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function salvar(ids: Set<string>): void {
  try {
    localStorage.setItem(CHAVE_PRECARGA, JSON.stringify([...ids]));
  } catch {
    // sem armazenamento: tenta de novo na próxima abertura
  }
}
