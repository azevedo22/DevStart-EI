import { WorkMode } from '@devstart/shared-types';

/** Uma vaga como vem da API do ITJobs.pt (só os campos usados). */
export interface ItjobsJob {
  id: number;
  title: string;
  body?: string;
  slug?: string;
  publishedAt?: string;
  updatedAt?: string;
  workModel?: number | null;
  company?: { id?: number; name?: string; logo?: string | null; slug?: string };
  locations?: { id: number; name: string }[];
  contracts?: { id: number; name: string }[];
}

interface ItjobsSearchResponse {
  total?: number;
  results?: ItjobsJob[];
}

export class ItjobsError extends Error {}

/** 0 presencial, 1 remoto, 2 híbrido (documentação da API). */
const WORK_MODELS: Record<number, WorkMode> = {
  0: 'ONSITE',
  1: 'REMOTE',
  2: 'HYBRID',
};

export function workModeOf(job: ItjobsJob): WorkMode | null {
  return job.workModel == null ? null : (WORK_MODELS[job.workModel] ?? null);
}

/** Página pública da vaga no ITJobs.pt: é lá que o utilizador se candidata. */
export function jobUrl(job: ItjobsJob): string {
  return `https://www.itjobs.pt/oferta/${job.id}${job.slug ? `/${job.slug}` : ''}`;
}

/**
 * Cliente mínimo da API do ITJobs.pt (GET /job/search.json). A chave vai como
 * parâmetro (é assim que a API a pede) e nunca aparece em mensagens de erro.
 */
export class ItjobsClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs = 20_000,
  ) {}

  get enabled(): boolean {
    return !!this.apiKey;
  }

  async search(q: string, page: number, limit: number): Promise<ItjobsJob[]> {
    const url = new URL(`${this.baseUrl.replace(/\/$/, '')}/job/search.json`);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('q', q);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(limit));

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { 'user-agent': 'DevStartEI/1.0', accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new ItjobsError(
        (err as Error).name === 'TimeoutError'
          ? 'o ITJobs.pt demorou demasiado a responder'
          : 'não foi possível ligar ao ITJobs.pt',
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new ItjobsError(
        'a chave do ITJobs.pt foi recusada (confirma ITJOBS_API_KEY no .env)',
      );
    }
    if (!res.ok) {
      throw new ItjobsError(`o ITJobs.pt respondeu com erro ${res.status}`);
    }
    const body = (await res.json().catch(() => null)) as
      ItjobsSearchResponse | { error?: unknown } | null;
    if (!body || 'error' in body) {
      throw new ItjobsError('o ITJobs.pt devolveu uma resposta inválida');
    }
    return (body as ItjobsSearchResponse).results ?? [];
  }
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  euro: '€',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  bull: '•',
};

/** O anúncio vem em HTML: passa a texto simples, com as quebras de linha. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|ul|ol|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Início do anúncio, cortado numa palavra. */
export function summarize(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  return (
    cut.slice(
      0,
      cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : cut.length,
    ) + '…'
  );
}
