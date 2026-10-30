import {
  BACKGROUND_LIMITS,
  Competency,
  CvCompetencySuggestion,
  CvDraft,
  CvProfileFields,
  EXPERIENCE_KINDS,
  ExperienceKind,
  IndustryPractice,
  LANGUAGE_LEVELS,
  LEVELS,
  LanguageLevel,
  LanguageSkill,
  Level,
  PROFILE_LIMITS,
  SaveEducationRequest,
  SaveExperienceRequest,
  SaveProjectRequest,
  YEAR_MONTH_PATTERN,
  detectCompetencies,
} from '@devstart/shared-types';

/**
 * Converte a resposta do modelo num CvDraft válido.
 *
 * O modelo segue o JSON Schema, mas os valores são texto livre: datas noutros
 * formatos, links sem protocolo, anos impossíveis, tecnologias com nomes
 * diferentes dos do catálogo. Aqui tudo é validado, corrigido quando é óbvio,
 * e descartado quando não dá para confiar. O resultado passa sempre nas
 * mesmas validações que a API aplica ao importar.
 */
export function normalizeCvExtraction(
  raw: unknown,
  cvText: string,
  catalog: Competency[],
): CvDraft {
  const r = asObject(raw);
  const warnings: string[] = [];

  const education = asArray(r['education'])
    .map(toEducation)
    .filter((e): e is SaveEducationRequest => e !== null)
    .slice(0, BACKGROUND_LIMITS.educationPerUser);

  const experience = asArray(r['experience'])
    .map(toExperience)
    .filter((e): e is SaveExperienceRequest => e !== null)
    .slice(0, BACKGROUND_LIMITS.experiencePerUser);

  const languages = dedupeBy(
    asArray(r['languages'])
      .map(toLanguage)
      .filter((l): l is LanguageSkill => l !== null),
    (l) => l.language.toLowerCase(),
  ).slice(0, BACKGROUND_LIMITS.languagesPerUser);

  // Competências: cada tecnologia indicada pelo modelo é mapeada para o catálogo.
  const suggestions = new Map<string, CvCompetencySuggestion>();
  const unmatched: string[] = [];
  for (const item of asArray(r['skills'])) {
    const s = asObject(item);
    const name = text(s['name'], 60);
    if (!name) continue;
    const level = oneOf(s['level'], LEVELS) ?? 'BASIC';
    const ids = detectCompetencies(name, catalog);
    if (!ids.length) unmatched.push(name);
    for (const id of ids) addSuggestion(suggestions, id, level, name);
  }
  // E tudo o que o catálogo reconhece no texto do CV e o modelo não referiu.
  for (const id of detectCompetencies(cvText, catalog)) {
    addSuggestion(suggestions, id, 'BASIC', 'mencionado no CV');
  }

  const projects = asArray(r['projects'])
    .map((p) => toProject(p, catalog))
    .filter((p): p is SaveProjectRequest => p !== null)
    .slice(0, 10);
  // As tecnologias dos projetos também são competências demonstradas.
  for (const p of projects) {
    for (const id of p.competencyIds) {
      addSuggestion(suggestions, id, 'BASIC', `projeto "${p.title}"`);
    }
  }

  const links = findLinks(cvText);
  const fields: CvProfileFields = {
    headline: text(r['headline'], PROFILE_LIMITS.headline),
    location: text(r['location'], BACKGROUND_LIMITS.location),
    bio: text(r['summary'], PROFILE_LIMITS.bio),
    linkedinUrl: url(r['linkedinUrl'], /linkedin\.com\//i) ?? links.linkedinUrl,
    githubUrl: url(r['githubUrl'], /github\.com\//i) ?? links.githubUrl,
    portfolioUrl: url(r['portfolioUrl']),
    ...mainDegree(education),
  };

  if (!education.length && !experience.length && !suggestions.size) {
    warnings.push(
      'Não consegui extrair quase nada deste CV. Confirma se é o ficheiro certo.',
    );
  }

  return {
    fields,
    education,
    experience,
    languages,
    competencies: [...suggestions.values()],
    unmatchedSkills: dedupeBy(unmatched, (s) => s.toLowerCase()),
    projects,
    source: 'ai',
    warnings,
  };
}

/**
 * Sem IA (Ollama desligado ou indisponível): o que dá para tirar só com
 * palavras-chave, que é pouco mas fiável: competências do catálogo e links.
 */
export function keywordOnlyDraft(
  cvText: string,
  catalog: Competency[],
  reason: string,
): CvDraft {
  const links = findLinks(cvText);
  return {
    fields: {
      headline: null,
      location: null,
      university: null,
      graduationYear: null,
      bio: null,
      linkedinUrl: links.linkedinUrl,
      githubUrl: links.githubUrl,
      portfolioUrl: null,
    },
    education: [],
    experience: [],
    languages: [],
    competencies: detectCompetencies(cvText, catalog).map((competencyId) => ({
      competencyId,
      level: 'BASIC' as Level,
      evidence: 'mencionado no CV',
    })),
    unmatchedSkills: [],
    projects: [],
    source: 'keywords',
    warnings: [
      `${reason} Sem a IA, só foram detetadas competências e links; o resto preenches à mão.`,
    ],
  };
}

// ── Conversões ────────────────────────────────────────────────

const LEVEL_RANK: Record<Level, number> = {
  BASIC: 0,
  INTERMEDIATE: 1,
  ADVANCED: 2,
};

/** Se a mesma competência aparece várias vezes, fica o nível mais alto e a primeira evidência. */
function addSuggestion(
  map: Map<string, CvCompetencySuggestion>,
  competencyId: string,
  level: Level,
  evidence: string,
): void {
  const current = map.get(competencyId);
  if (!current) {
    map.set(competencyId, { competencyId, level, evidence });
  } else if (LEVEL_RANK[level] > LEVEL_RANK[current.level]) {
    current.level = level;
  }
}

function toEducation(item: unknown): SaveEducationRequest | null {
  const e = asObject(item);
  const institution = text(e['institution'], BACKGROUND_LIMITS.institution);
  const degree = text(e['degree'], BACKGROUND_LIMITS.degree);
  if (!institution || !degree) return null;
  let startYear = year(e['startYear']);
  let endYear = year(e['endYear']);
  if (startYear && endYear && endYear < startYear) {
    [startYear, endYear] = [endYear, startYear];
  }
  return {
    institution,
    degree,
    fieldOfStudy: text(e['fieldOfStudy'], BACKGROUND_LIMITS.fieldOfStudy),
    startYear,
    endYear,
  };
}

function toExperience(item: unknown): SaveExperienceRequest | null {
  const e = asObject(item);
  const organization = text(e['organization'], BACKGROUND_LIMITS.organization);
  const role = text(e['role'], BACKGROUND_LIMITS.role);
  if (!organization || !role) return null;
  let startDate = yearMonth(e['startDate']);
  let endDate = yearMonth(e['endDate']);
  if (startDate && endDate && endDate < startDate) {
    [startDate, endDate] = [endDate, startDate];
  }
  return {
    organization,
    role,
    kind: oneOf(e['kind'], EXPERIENCE_KINDS) ?? ('OTHER' as ExperienceKind),
    startDate,
    endDate,
    description: text(
      e['description'],
      BACKGROUND_LIMITS.experienceDescription,
    ),
  };
}

function toLanguage(item: unknown): LanguageSkill | null {
  const l = asObject(item);
  const language = text(l['language'], BACKGROUND_LIMITS.language);
  const level = oneOf(l['level'], LANGUAGE_LEVELS) as LanguageLevel | null;
  if (!language || language.length < 2 || !level) return null;
  return { language, level };
}

function toProject(
  item: unknown,
  catalog: Competency[],
): SaveProjectRequest | null {
  const p = asObject(item);
  const title = text(p['title'], PROFILE_LIMITS.projectTitle);
  let description = text(p['description'], PROFILE_LIMITS.projectDescription);
  if (!title || title.length < 2) return null;
  // A API pede pelo menos 10 caracteres de descrição.
  if (!description || description.length < 10) {
    description = `Projeto ${title}.`.padEnd(10, '.');
  }
  const technologies = asArray(p['technologies'])
    .map((t) => text(t, 60))
    .filter((t): t is string => !!t);
  const competencyIds = [
    ...new Set(
      [...technologies, description].flatMap((t) =>
        detectCompetencies(t, catalog),
      ),
    ),
  ].slice(0, PROFILE_LIMITS.competenciesPerProject);

  const academic = p['academic'] === true;
  return {
    title,
    description,
    repositoryUrl: url(p['repositoryUrl']),
    liveUrl: url(p['liveUrl']),
    origin: academic ? 'ACADEMIC' : 'PERSONAL',
    academicContext: academic
      ? text(p['academicContext'], PROFILE_LIMITS.academicContext)
      : null,
    competencyIds,
    practices: practicesFrom(competencyIds),
  };
}

/** Práticas de indústria que se deduzem das tecnologias do projeto. */
function practicesFrom(ids: string[]): IndustryPractice[] {
  const practices: IndustryPractice[] = [];
  if (ids.includes('docker')) practices.push('DOCKER');
  if (ids.includes('ci-cd')) practices.push('CI_CD');
  if (ids.some((id) => id.endsWith('-testing'))) practices.push('TESTS');
  return practices;
}

const HIGHER_EDUCATION =
  /licenciatura|mestrado|doutoramento|bachelor|master|bsc|msc|phd|engenharia|ctesp/i;

/**
 * Instituição e ano de conclusão do perfil: os da formação superior mais
 * recente (as entradas já vêm ordenadas como no CV, normalmente a mais recente
 * primeiro, mas ordena-se na mesma).
 */
function mainDegree(
  education: SaveEducationRequest[],
): Pick<CvProfileFields, 'university' | 'graduationYear'> {
  const higher = education
    .filter((e) => HIGHER_EDUCATION.test(e.degree))
    .sort((a, b) => (b.endYear ?? 9999) - (a.endYear ?? 9999));
  const main = higher[0];
  if (!main) return { university: null, graduationYear: null };
  const maxYear =
    new Date().getFullYear() + PROFILE_LIMITS.maxGraduationYearAhead;
  const y = main.endYear;
  return {
    university: main.institution.slice(0, PROFILE_LIMITS.university),
    graduationYear:
      y && y >= PROFILE_LIMITS.minGraduationYear && y <= maxYear ? y : null,
  };
}

/** Links do LinkedIn e do GitHub escritos no CV, mesmo sem https://. */
export function findLinks(cvText: string): {
  linkedinUrl: string | null;
  githubUrl: string | null;
} {
  const linkedin =
    /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[\w%-]+\/?/i.exec(
      cvText,
    );
  const github =
    /(?:https?:\/\/)?(?:www\.)?github\.com\/(?!features|about|login)[\w-]+\/?(?![\w/])/i.exec(
      cvText,
    );
  return {
    linkedinUrl: linkedin ? url(linkedin[0]) : null,
    githubUrl: github ? url(github[0]) : null,
  };
}

// ── Valores primitivos ────────────────────────────────────────

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** Texto limpo e cortado ao limite; vazio, "null" ou "N/A" contam como ausente. */
function text(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  if (!t || /^(null|n\/?a|none|-|—)$/i.test(t)) return null;
  return t.slice(0, max).trim();
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : null;
}

function year(v: unknown): number | null {
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : v;
  if (typeof n !== 'number' || !Number.isInteger(n)) return null;
  return n >= 1950 && n <= new Date().getFullYear() + 8 ? n : null;
}

/** "2025-02", "2025-2", "02/2025" ou só "2025" (→ 2025-01). */
function yearMonth(v: unknown): string | null {
  if (typeof v !== 'string') return year(v) ? `${v}-01` : null;
  const t = v.trim();
  let m = /^(\d{4})-(\d{1,2})/.exec(t);
  if (m) return validYearMonth(m[1], m[2]);
  m = /^(\d{1,2})[/.-](\d{4})$/.exec(t);
  if (m) return validYearMonth(m[2], m[1]);
  m = /^(\d{4})$/.exec(t);
  if (m) return validYearMonth(m[1], '1');
  return null;
}

function validYearMonth(y: string, mo: string): string | null {
  const value = `${y}-${mo.padStart(2, '0')}`;
  return YEAR_MONTH_PATTERN.test(value) && year(Number(y)) ? value : null;
}

/** Só http(s); acrescenta https:// a "linkedin.com/in/..."; `mustMatch` filtra o domínio. */
function url(v: unknown, mustMatch?: RegExp): string | null {
  const t = text(v, PROFILE_LIMITS.url);
  if (!t || /\s/.test(t)) return null;
  const withProtocol = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withProtocol);
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.'))
      return null;
  } catch {
    return null;
  }
  if (mustMatch && !mustMatch.test(withProtocol)) return null;
  return withProtocol.replace(/\/$/, '');
}

function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = key(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
