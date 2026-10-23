import { deIso } from './stats';

/** "2026-10-23" → "23 de out" (com o ano quando não é o ano de `hoje`). */
export function dataCurta(iso: string, hoje: Date = new Date()): string {
  const d = deIso(iso);
  const opcoes: Intl.DateTimeFormatOptions =
    d.getFullYear() === hoje.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' };
  return d.toLocaleDateString('pt-BR', opcoes).replace(/\./g, '');
}

/** 72.5 → "72,5" (sempre uma casa decimal). */
export function formatarKg(kg: number): string {
  return kg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
