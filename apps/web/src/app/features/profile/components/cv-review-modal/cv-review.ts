import {
  CvDraft,
  CvProfileFields,
  Education,
  Experience,
  ImportCvRequest,
  LanguageLevel,
  Level,
  Profile,
  Project,
  SaveEducationRequest,
  SaveExperienceRequest,
  SaveProjectRequest,
} from '@devstart/shared-types';

/**
 * A revisão do que a IA leu do CV: cada item com "marcado" e "já no perfil".
 * Por omissão vem tudo marcado, exceto o que já está no perfil.
 *
 * O CV novo substitui o que veio do anterior (formação, experiência e projetos
 * com origem 'cv' que a pessoa não editou): a revisão mostra-os e deixa
 * desligar a substituição. O que a pessoa criou ou editou nunca sai, e conta
 * como "já no perfil".
 *
 * As linhas são objetos mutáveis de propósito: os ecrãs da revisão ligam-se a
 * elas com ngModel e o pedido final lê-as no fim.
 */

export type FieldKey = keyof CvProfileFields;

export const FIELD_LABELS: Record<FieldKey, string> = {
  headline: 'Título profissional',
  location: 'Localização',
  university: 'Instituição',
  graduationYear: 'Ano de conclusão',
  bio: 'Apresentação',
  linkedinUrl: 'LinkedIn',
  githubUrl: 'GitHub',
  portfolioUrl: 'Portefólio',
};

export interface Row<T> {
  value: T;
  selected: boolean;
  /** Já existe no perfil (fica desmarcado; o servidor também não o duplicaria). */
  existing: boolean;
}

export interface FieldRow {
  key: FieldKey;
  label: string;
  value: string;
  /** O valor no perfil, quando é diferente do que veio do CV. */
  current: string | null;
  selected: boolean;
}

export type CompetencyRow = Row<{
  competencyId: string;
  level: Level;
  evidence: string;
}>;
export type LanguageRow = Row<{ language: string; level: LanguageLevel }>;

/** O que veio do CV anterior e sai se a substituição ficar ligada. */
export interface PreviousImport {
  education: Education[];
  experience: Experience[];
  projects: Project[];
}

export interface CvReview {
  previous: PreviousImport;
  /** Substituir o que veio do CV anterior (ligado por omissão, se houver). */
  replacePrevious: boolean;
  fields: FieldRow[];
  competencies: CompetencyRow[];
  education: Row<SaveEducationRequest>[];
  experience: Row<SaveExperienceRequest>[];
  languages: LanguageRow[];
  projects: Row<SaveProjectRequest>[];
}

const LEVEL_RANK: Record<Level, number> = {
  BASIC: 0,
  INTERMEDIATE: 1,
  ADVANCED: 2,
};
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export function buildReview(
  draft: CvDraft,
  profile: Profile | null,
  projects: Project[],
): CvReview {
  const fields = (Object.keys(FIELD_LABELS) as FieldKey[])
    .filter((key) => draft.fields[key] !== null && draft.fields[key] !== '')
    .map((key): FieldRow => {
      const current = profile?.[key] ?? null;
      const value = String(draft.fields[key]);
      return {
        key,
        label: FIELD_LABELS[key],
        value,
        current:
          current !== null && String(current) !== value
            ? String(current)
            : null,
        // Só vem marcado se o campo estiver vazio no perfil.
        selected: current === null || current === '',
      };
    });

  const declared = new Map(
    (profile?.competencies ?? []).map((c) => [c.competencyId, c.level]),
  );
  const competencies = draft.competencies.map((c): CompetencyRow => {
    const current = declared.get(c.competencyId);
    return {
      value: { ...c },
      existing: !!current,
      // Já declarada com nível igual ou superior: nada a ganhar.
      selected: !current || LEVEL_RANK[c.level] > LEVEL_RANK[current],
    };
  });

  // "Já no perfil" é só o que fica: o que veio do CV anterior vai ser substituído.
  const manual = <T extends { source: string }>(rows: T[]) =>
    rows.filter((r) => r.source !== 'cv');
  const previous: PreviousImport = {
    education: (profile?.education ?? []).filter((e) => e.source === 'cv'),
    experience: (profile?.experience ?? []).filter((e) => e.source === 'cv'),
    projects: projects.filter((p) => p.source === 'cv'),
  };

  const eduKeys = new Set(
    manual(profile?.education ?? []).map(
      (e) => `${norm(e.institution)}|${norm(e.degree)}`,
    ),
  );
  const education = draft.education.map((e) => {
    const existing = eduKeys.has(`${norm(e.institution)}|${norm(e.degree)}`);
    return { value: e, existing, selected: !existing };
  });

  const expKey = (e: {
    organization: string;
    role: string;
    startDate: string | null;
  }) => `${norm(e.organization)}|${norm(e.role)}|${e.startDate ?? ''}`;
  const expKeys = new Set(manual(profile?.experience ?? []).map(expKey));
  const experience = draft.experience.map((e) => {
    const existing = expKeys.has(expKey(e));
    return { value: e, existing, selected: !existing };
  });

  const langs = new Map(
    (profile?.languages ?? []).map((l) => [norm(l.language), l.level]),
  );
  const languages = draft.languages.map((l): LanguageRow => {
    const current = langs.get(norm(l.language));
    return {
      value: { ...l },
      existing: !!current,
      selected: current !== l.level,
    };
  });

  const titles = new Set(manual(projects).map((p) => norm(p.title)));
  const projectRows = draft.projects.map((p) => {
    const existing = titles.has(norm(p.title));
    return { value: p, existing, selected: !existing };
  });

  return {
    previous,
    replacePrevious: previousCount(previous) > 0,
    fields,
    competencies,
    education,
    experience,
    languages,
    projects: projectRows,
  };
}

const allRows = (r: CvReview): { selected: boolean }[] => [
  ...r.fields,
  ...r.competencies,
  ...r.education,
  ...r.experience,
  ...r.languages,
  ...r.projects,
];

export const previousCount = (p: PreviousImport): number =>
  p.education.length + p.experience.length + p.projects.length;

export const isEmpty = (r: CvReview): boolean => allRows(r).length === 0;

export const selectedCount = (r: CvReview): number =>
  allRows(r).filter((row) => row.selected).length;

/** O pedido de importação: só o que está marcado, com os valores editados. */
export function importRequest(r: CvReview): ImportCvRequest {
  const picked = <T>(rows: Row<T>[]) =>
    rows.filter((row) => row.selected).map((row) => row.value);

  const fields: Partial<CvProfileFields> = {};
  for (const f of r.fields.filter((f) => f.selected)) {
    const v = f.value.trim();
    (fields as Record<string, unknown>)[f.key] =
      f.key === 'graduationYear' ? (v ? Number(v) : null) : v || null;
  }

  return {
    fields,
    competencies: picked(r.competencies).map(({ competencyId, level }) => ({
      competencyId,
      level,
    })),
    education: picked(r.education),
    experience: picked(r.experience),
    languages: picked(r.languages),
    projects: picked(r.projects),
    ...(previousCount(r.previous) > 0 && {
      replacePrevious: r.replacePrevious,
    }),
  };
}

/** " · 2021 – 2024", " · 2023 – atual" ou nada. */
export function years(e: SaveEducationRequest): string {
  if (!e.startYear && !e.endYear) return '';
  return ` · ${e.startYear ?? '?'} – ${e.endYear ?? 'atual'}`;
}

/** "09/2023 – 06/2024", "09/2023 – atual" ou nada. */
export function period(e: SaveExperienceRequest): string {
  const fmt = (d: string | null) =>
    d ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : null;
  const start = fmt(e.startDate);
  const end = fmt(e.endDate) ?? 'atual';
  return start ? `${start} – ${end}` : '';
}
