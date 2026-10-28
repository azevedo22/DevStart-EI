import { Transform } from 'class-transformer';

/**
 * Texto opcional: tira espaços e converte "" em null, para "apagar um campo"
 * ter uma só representação na base de dados.
 */
export const TrimToNull = () =>
  Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });

/** Texto obrigatório: só tira espaços. */
export const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
