import {
  InterviewType,
  REPLY_KINDS,
  ReplyCandidate,
  ReplyDraft,
  ReplyKind,
} from '@devstart/shared-types';
import { asObject, oneOf, text } from '../ai/ai-output';

type DraftFields = Pick<
  ReplyDraft,
  'kind' | 'applicationId' | 'interviewType' | 'scheduledAt' | 'summary'
>;

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// ── Palavras-chave (quando a IA não responde, e para confirmar o que ela diz) ─

const OFFER =
  /proposta (de trabalho|contratual|de emprego)|oferta de (trabalho|emprego)|job offer|offer letter|pleased to (extend|offer)|gostar[ií]amos de (te|lhe) (fazer|apresentar) uma proposta/i;
const REJECTION =
  /infelizmente|lamentamos|n[ãa]o (foi|fomos) poss[ií]vel avan[çc]ar|n[ãa]o vamos avan[çc]ar|outros? candidat|outro perfil|n[ãa]o (foste|foi) selecionad|unfortunately|we regret|not (be )?moving forward|decided (not )?to (pursue|proceed|move forward) with other|other candidates/i;
const TEST =
  /teste t[ée]cnico|desafio t[ée]cnico|exerc[ií]cio t[ée]cnico|coding (challenge|test|assessment|exercise)|take[- ]home|technical (test|assessment|challenge)|hackerrank|codility|codesignal/i;
const INTERVIEW =
  /entrevista|interview|conversa (connosco|com a equipa)|(video)?chamada|disponibilidade|availability|schedule a (call|meeting)|agendar/i;
const TECHNICAL = /t[ée]cnic|technical/i;

export function guessKind(email: string): ReplyKind {
  if (OFFER.test(email)) return 'OFFER';
  if (REJECTION.test(email)) return 'REJECTION';
  if (TEST.test(email)) return 'TECHNICAL_TEST';
  if (INTERVIEW.test(email)) return 'INTERVIEW';
  return 'OTHER';
}

/**
 * A candidatura pela empresa: a única cujo nome aparece no email. Se houver
 * várias da mesma empresa, desempata pelo título da vaga; senão, null (a
 * pessoa escolhe).
 */
export function guessCandidate(
  email: string,
  candidates: ReplyCandidate[],
  companyHint?: string | null,
): string | null {
  const haystack = ` ${norm(`${email} ${companyHint ?? ''}`)} `;
  const byCompany = candidates.filter((c) => {
    const name = norm(c.companyName);
    return name.length >= 2 && haystack.includes(` ${name} `);
  });
  if (byCompany.length === 1) return byCompany[0].id;
  if (byCompany.length > 1) {
    const byTitle = byCompany.filter((c) =>
      haystack.includes(norm(c.jobTitle)),
    );
    if (byTitle.length === 1) return byTitle[0].id;
  }
  return null;
}

/** Do detalhe de uma candidatura vem só essa: a resposta é dela. */
function only(candidates: ReplyCandidate[]): string | null {
  return candidates.length === 1 ? candidates[0].id : null;
}

// ── Datas ─────────────────────────────────────────────────────

const DAY = 86_400_000;

/** Uma data real, entre uma semana atrás e seis meses à frente. */
function plausibleDate(date: string, today: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return false;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(t);
  if (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return false;
  const diff = (t - Date.parse(`${today}T00:00:00Z`)) / DAY;
  return diff >= -7 && diff <= 183;
}

function validTime(time: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  return !!m && +m[1] < 24 && +m[2] < 60;
}

function joinDateTime(
  date: string | null,
  time: string | null,
  today: string,
): string | null {
  if (!date || !plausibleDate(date, today)) return null;
  return time && validTime(time) ? `${date}T${time}` : date;
}

/**
 * Data e hora por padrões simples ("12/11", "12/11/2026", "10:30", "10h30"),
 * para quando a IA não responde. Sem ano, é a próxima ocorrência.
 */
export function guessDateTime(email: string, today: string): string | null {
  const d = /\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/.exec(email);
  if (!d) return null;
  const year0 = +today.slice(0, 4);
  const pad = (n: number) => String(n).padStart(2, '0');
  let year = d[3] ? +d[3] : year0;
  if (year < 100) year += 2000;
  let date = `${year}-${pad(+d[2])}-${pad(+d[1])}`;
  if (!d[3] && date < today) date = `${year + 1}-${pad(+d[2])}-${pad(+d[1])}`;
  const t = /\b(\d{1,2})\s?(?::|h)\s?(\d{2})\b/i.exec(email);
  const time = t ? `${pad(+t[1])}:${t[2]}` : null;
  return joinDateTime(date, time, today);
}

// ── Normalização da resposta da IA ──────────────────────────────

export function normalizeReply(
  raw: unknown,
  email: string,
  candidates: ReplyCandidate[],
  today: string,
): DraftFields & { warnings: string[] } {
  const o = asObject(raw);
  const warnings: string[] = [];
  const kind = oneOf(o['kind'], REPLY_KINDS) ?? guessKind(email);

  const ids = new Set(candidates.map((c) => c.id));
  const aiId = text(o['candidateId'], 64);
  const applicationId =
    aiId && ids.has(aiId)
      ? aiId
      : (guessCandidate(email, candidates, text(o['companyName'], 160)) ??
        only(candidates));
  if (!applicationId)
    warnings.push(
      'Não percebi a que candidatura pertence esta resposta. Escolhe-a abaixo.',
    );

  const withDate = kind === 'INTERVIEW' || kind === 'TECHNICAL_TEST';
  const scheduledAt = withDate
    ? joinDateTime(text(o['date'], 10), text(o['time'], 5), today)
    : null;

  return {
    kind,
    applicationId,
    interviewType:
      kind === 'INTERVIEW'
        ? oneOf<InterviewType>(o['interviewType'], ['HR', 'TECHNICAL'])
        : null,
    scheduledAt,
    summary: text(o['summary'], 240, { ellipsis: true }),
    warnings,
  };
}

/** Sem IA: o que as palavras-chave e as datas no texto conseguem dizer. */
export function keywordReply(
  email: string,
  candidates: ReplyCandidate[],
  today: string,
  reason: string,
): DraftFields & { warnings: string[] } {
  const kind = guessKind(email);
  const applicationId = guessCandidate(email, candidates) ?? only(candidates);
  const warnings = [`Analisado sem IA (${reason}). Confirma o tipo e a data.`];
  if (!applicationId)
    warnings.push(
      'Não percebi a que candidatura pertence esta resposta. Escolhe-a abaixo.',
    );
  const withDate = kind === 'INTERVIEW' || kind === 'TECHNICAL_TEST';
  return {
    kind,
    applicationId,
    interviewType:
      kind === 'INTERVIEW'
        ? TECHNICAL.test(email)
          ? 'TECHNICAL'
          : 'HR'
        : null,
    scheduledAt: withDate ? guessDateTime(email, today) : null,
    summary: null,
    warnings,
  };
}
