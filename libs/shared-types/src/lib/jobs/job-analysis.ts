import type { Competency } from '../profile/profile.types';

/**
 * Análise de anúncios de emprego — função pura, partilhada entre frontend e backend.
 *
 * Objetivo: responder rapidamente à pergunta "vale a pena candidatar-me com 0 anos
 * de experiência?" e listar as competências pedidas, para comparar com o perfil.
 *
 * É uma heurística por palavras-chave (sem IA): previsível, testável e explicável.
 * Cada conclusão vem acompanhada dos sinais que a justificam.
 */

export type Seniority = 'INTERN' | 'JUNIOR' | 'MID' | 'SENIOR' | 'UNKNOWN';

export const SENIORITIES: readonly Seniority[] = [
  'INTERN',
  'JUNIOR',
  'MID',
  'SENIOR',
  'UNKNOWN',
];

export type Accessibility =
  'ENTRY_FRIENDLY' | 'STRETCH' | 'UNREALISTIC' | 'UNKNOWN';

export const ACCESSIBILITIES: readonly Accessibility[] = [
  'ENTRY_FRIENDLY',
  'STRETCH',
  'UNREALISTIC',
  'UNKNOWN',
];

export const SENIORITY_LABELS: Record<Seniority, string> = {
  INTERN: 'Estágio',
  JUNIOR: 'Júnior',
  MID: 'Intermédio',
  SENIOR: 'Sénior',
  UNKNOWN: 'Não indicada',
};

export const ACCESSIBILITY_LABELS: Record<Accessibility, string> = {
  ENTRY_FRIENDLY: 'Acessível',
  STRETCH: 'Vale a pena tentar',
  UNREALISTIC: 'Pouco realista',
  UNKNOWN: 'Por avaliar',
};

export interface AccessibilityVerdict {
  accessibility: Accessibility;
  /** "Júnior" no título, mas pede 3+ anos: o caso que mais engana recém-formados. */
  mislabeledJunior: boolean;
  reasons: string[];
}

export interface JobAnalysis extends AccessibilityVerdict {
  competencyIds: string[];
  yearsRequired: number | null;
  seniority: Seniority;
}

// ─────────────────────────────────────────────────────────────────
// Classificação (usada também pelo servidor, a partir dos campos guardados)
// ─────────────────────────────────────────────────────────────────

export function classifyAccessibility(input: {
  yearsRequired: number | null;
  seniority: Seniority;
}): AccessibilityVerdict {
  const { yearsRequired: years, seniority } = input;
  const reasons: string[] = [];
  const juniorLabel = seniority === 'JUNIOR' || seniority === 'INTERN';

  if (years !== null && years >= 3) {
    reasons.push(`Pede ${years}+ anos de experiência.`);
    if (juniorLabel)
      reasons.push('Diz-se júnior, mas os requisitos não são de júnior.');
    return {
      accessibility: 'UNREALISTIC',
      mislabeledJunior: juniorLabel,
      reasons,
    };
  }
  if (seniority === 'SENIOR' || seniority === 'MID') {
    reasons.push(`Vaga de nível ${SENIORITY_LABELS[seniority].toLowerCase()}.`);
    return {
      accessibility: seniority === 'SENIOR' ? 'UNREALISTIC' : 'STRETCH',
      mislabeledJunior: false,
      reasons,
    };
  }
  if (years === 2) {
    reasons.push('Pede 2 anos: um bom projeto pessoal pode compensar.');
    return { accessibility: 'STRETCH', mislabeledJunior: false, reasons };
  }
  if (years !== null && years <= 1) {
    reasons.push(
      years === 0 ? 'Não exige experiência.' : 'Pede até 1 ano de experiência.',
    );
    return {
      accessibility: 'ENTRY_FRIENDLY',
      mislabeledJunior: false,
      reasons,
    };
  }
  if (juniorLabel) {
    reasons.push(
      `Vaga de ${SENIORITY_LABELS[seniority].toLowerCase()} sem anos mínimos indicados.`,
    );
    return {
      accessibility: 'ENTRY_FRIENDLY',
      mislabeledJunior: false,
      reasons,
    };
  }
  reasons.push('O anúncio não indica nível nem anos de experiência.');
  return { accessibility: 'UNKNOWN', mislabeledJunior: false, reasons };
}

// ─────────────────────────────────────────────────────────────────
// Extração a partir do texto do anúncio
// ─────────────────────────────────────────────────────────────────

/** Palavras demasiado genéricas em anúncios para servirem de sinal ("cache", "signals"…). */
const IGNORED_TERMS = new Set([
  'cache',
  'signals',
  'shell',
  'pipelines',
  'containers',
  'responsive',
  'nest',
]);

/**
 * Termos que só contam escritos desta forma exata, porque em minúsculas são
 * palavras comuns: "rest of the team", "solid understanding", "express interest".
 */
const CASE_SENSITIVE: Record<string, string[]> = {
  rest: ['REST', 'RESTful'],
  restful: ['REST', 'RESTful'],
  solid: ['SOLID'],
  spring: ['Spring', 'Spring Boot'],
  express: ['Express', 'Express.js', 'ExpressJS'],
  rag: ['RAG'],
  ts: ['TS'],
  js: ['JS'],
  ml: ['ML'],
  py: [],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** Fronteira de palavra que funciona com termos como "C#", ".NET" ou "CI/CD" (\b não chega). */
const bounded = (term: string, flags: string) =>
  new RegExp(
    `(?<![\\p{L}\\p{N}])${escape(term)}(?![\\p{L}\\p{N}])`,
    flags + 'u',
  );

function termPatterns(competency: Competency): RegExp[] {
  const terms = [
    competency.name,
    competency.id.replace(/-/g, ' '),
    ...competency.aliases,
  ];
  const patterns: RegExp[] = [];
  for (const term of terms) {
    const key = term.toLowerCase();
    if (IGNORED_TERMS.has(key)) continue;
    if (key in CASE_SENSITIVE) {
      patterns.push(...CASE_SENSITIVE[key].map((exact) => bounded(exact, '')));
    } else {
      patterns.push(bounded(term, 'i'));
    }
  }
  return patterns;
}

export function detectCompetencies(
  text: string,
  catalog: Competency[],
): string[] {
  return catalog
    .filter((c) => termPatterns(c).some((re) => re.test(text)))
    .map((c) => c.id);
}

const NO_EXPERIENCE =
  /\b(sem experi[êe]ncia|n[ãa]o (?:é )?(?:exig|necess[áa]ri)\w*\s+experi[êe]ncia|no (?:prior )?experience (?:required|needed)|rec[ée]m[- ]licenciad\w*|rec[ée]m[- ]formad\w*|entry[- ]level|new grad\w*|graduate programme?)\b/i;

/** "2+ anos", "3 a 5 anos", "1-2 years", "at least 3 years", "mínimo de 2 anos". */
const YEARS =
  /(?:m[íi]nimo de|pelo menos|at least|minimum(?: of)?)?\s*(\d{1,2})\s*\+?\s*(?:(?:-|–|a|to|ou|or)\s*\d{1,2}\s*)?(?:anos?|years?|yrs?)\b/gi;

export function detectYearsRequired(text: string): number | null {
  if (NO_EXPERIENCE.test(text)) return 0;
  let max: number | null = null;
  for (const m of text.matchAll(YEARS)) {
    // Só conta quando fala de experiência por perto (evita "empresa com 20 anos").
    const around = text.slice(
      Math.max(0, m.index! - 60),
      m.index! + m[0].length + 60,
    );
    if (
      !/experi[êe]nc|experience|working with|a trabalhar|in a similar/i.test(
        around,
      )
    )
      continue;
    const years = Number(m[1]);
    if (years <= 15) max = max === null ? years : Math.max(max, years);
  }
  return max;
}

const SENIORITY_PATTERNS: [Seniority, RegExp][] = [
  ['INTERN', /\b(est[áa]gio|estagi[áa]ri[oa]|internship|intern|trainee)\b/i],
  ['SENIOR', /\b(s[ée]nior|sr\.?|lead|principal|staff engineer|tech lead)\b/i],
  ['MID', /\b(mid[- ]level|pleno|intermedi[áo]rio|intermediate)\b/i],
  [
    'JUNIOR',
    /\b(j[úu]nior|jr\.?|entry[- ]level|graduate|rec[ée]m[- ](?:licenciad|formad)\w*)\b/i,
  ],
];

/** O título manda: um anúncio "Júnior" que menciona "trabalhar com seniores" continua júnior. */
export function detectSeniority(title: string, text = ''): Seniority {
  for (const source of [title, text]) {
    for (const [level, re] of SENIORITY_PATTERNS) {
      if (source && re.test(source)) return level;
    }
  }
  return 'UNKNOWN';
}

export function analyzeJobPosting(
  input: { title: string; text: string },
  catalog: Competency[],
): JobAnalysis {
  const full = `${input.title}\n${input.text}`;
  const seniority = detectSeniority(input.title, input.text);
  const yearsRequired = detectYearsRequired(full);
  return {
    competencyIds: detectCompetencies(full, catalog),
    yearsRequired,
    seniority,
    ...classifyAccessibility({ yearsRequired, seniority }),
  };
}

// ─────────────────────────────────────────────────────────────────
// Comparação com o perfil
// ─────────────────────────────────────────────────────────────────

export interface ProfileMatch {
  matched: string[];
  missing: string[];
  /** null quando a vaga não tem competências registadas. */
  percentage: number | null;
}

export function matchWithProfile(
  requiredIds: string[],
  declared: ReadonlySet<string>,
): ProfileMatch {
  const matched = requiredIds.filter((id) => declared.has(id));
  const missing = requiredIds.filter((id) => !declared.has(id));
  return {
    matched,
    missing,
    percentage: requiredIds.length
      ? Math.round((matched.length / requiredIds.length) * 100)
      : null,
  };
}
