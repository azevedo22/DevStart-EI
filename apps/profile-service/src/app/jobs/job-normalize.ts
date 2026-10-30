import {
  APPLICATION_LIMITS,
  Competency,
  JobPostingDraft,
  SENIORITIES,
  Seniority,
  WORK_MODES,
  WorkMode,
  analyzeJobPosting,
  detectCompetencies,
  detectSeniority,
  detectYearsRequired,
} from '@devstart/shared-types';

/**
 * Transforma a resposta da IA num rascunho seguro: cortes de tamanho, valores
 * só dos conjuntos permitidos, competências ligadas ao catálogo. O que a IA não
 * disse, tenta-se pelas palavras-chave (as mesmas regras de antes da IA).
 */
export function normalizeJobExtraction(
  raw: unknown,
  postingText: string,
  catalog: Competency[],
): JobPostingDraft {
  const r = asObject(raw);
  const jobTitle = text(r['jobTitle'], APPLICATION_LIMITS.jobTitle);

  const seniority: Seniority =
    oneOf(r['seniority'], SENIORITIES) ??
    detectSeniority(jobTitle ?? '', postingText);

  const years = r['yearsRequired'];
  const yearsRequired =
    typeof years === 'number' &&
    Number.isInteger(years) &&
    years >= 0 &&
    years <= 30
      ? years
      : detectYearsRequired(postingText);

  const experience = dedupe(
    asArray(r['experience'])
      .map((e) => text(e, APPLICATION_LIMITS.experienceItem))
      .filter((e): e is string => e !== null),
  ).slice(0, APPLICATION_LIMITS.experienceItems);

  // Cada tecnologia indicada pela IA é ligada ao catálogo; o que não existe lá
  // mostra-se à parte. Só se a IA não indicar nenhuma se procura no texto:
  // a procura por palavras apanha falsos positivos ("Lumen Cloud" → Cloud).
  const ids: string[] = [];
  const other: string[] = [];
  for (const item of asArray(r['skills'])) {
    const name = text(item, 60);
    if (!name) continue;
    const found = detectCompetencies(name, catalog);
    if (!found.length) other.push(name);
    ids.push(...found);
  }
  if (!ids.length && !other.length)
    ids.push(...detectCompetencies(postingText, catalog));

  return {
    source: 'ai',
    analyzedBy: null, // preenchido pelo serviço, que sabe que IA usou
    sentToExternalService: false,
    warnings: [],
    companyName: text(r['companyName'], APPLICATION_LIMITS.companyName),
    jobTitle,
    seniority,
    yearsRequired,
    experienceRequirements: experience,
    competencyIds: [...new Set(ids)].slice(0, APPLICATION_LIMITS.competencies),
    otherSkills: dedupe(other).slice(0, 15),
    workMode: oneOf<WorkMode>(r['workMode'], WORK_MODES),
    location: text(r['location'], APPLICATION_LIMITS.location),
  };
}

/** Sem IA: o mesmo que a análise por palavras-chave fazia antes. */
export function keywordJobDraft(
  postingText: string,
  catalog: Competency[],
  reason: string,
): JobPostingDraft {
  const a = analyzeJobPosting({ title: '', text: postingText }, catalog);
  return {
    source: 'keywords',
    analyzedBy: null,
    sentToExternalService: false,
    warnings: [
      `Analisado sem IA (${reason.replace(/\.$/, '')}). Preenche a empresa, o título e a experiência pedida à mão.`,
    ],
    companyName: null,
    jobTitle: null,
    seniority: a.seniority,
    yearsRequired: a.yearsRequired,
    experienceRequirements: [],
    competencyIds: a.competencyIds.slice(0, APPLICATION_LIMITS.competencies),
    otherSkills: [],
    workMode: null,
    location: null,
  };
}

// ── Auxiliares ──────────────────────────────────────────────────

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** Texto limpo e cortado; null se vazio ou se a IA escreveu "null"/"N/A". */
function text(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  if (!t || /^(null|n\/a|none|desconhecid[oa]|não indicad[oa])$/i.test(t))
    return null;
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : null;
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = i.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
