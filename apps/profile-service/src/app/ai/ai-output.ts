/**
 * Leitura defensiva da resposta de uma IA. O esquema obriga a forma, mas os
 * valores continuam a ser texto livre: tudo o que não for do tipo esperado
 * conta como ausente, em vez de rebentar ou passar para a base de dados.
 * Partilhado pela leitura de CVs e de anúncios.
 */

export function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** O que as IAs escrevem quando não sabem: conta como ausente. */
const EMPTY_WORDS = /^(null|n\/?a|none|-|—|desconhecid[oa]|não indicad[oa])$/i;

/**
 * Texto limpo (espaços seguidos juntam-se) e cortado ao limite. Com
 * `ellipsis`, o corte termina em "…" para se perceber que havia mais.
 */
export function text(
  v: unknown,
  max: number,
  opts: { ellipsis?: boolean } = {},
): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  if (!t || EMPTY_WORDS.test(t)) return null;
  if (t.length <= max) return t;
  return opts.ellipsis
    ? t.slice(0, max - 1).trimEnd() + '…'
    : t.slice(0, max).trim();
}

/** O valor, se for um dos permitidos; senão null. */
export function oneOf<T extends string>(
  v: unknown,
  allowed: readonly T[],
): T | null {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : null;
}

/** Tira repetidos pela chave, ficando com a primeira ocorrência. */
export function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = key(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
