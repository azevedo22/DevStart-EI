import {
  APPLICATION_LIMITS,
  JobPostingDraft,
  Seniority,
  WorkMode,
} from '@devstart/shared-types';

/** Os campos do formulário que a análise do anúncio pode preencher. */
export interface DraftPatch {
  companyName?: string;
  jobTitle?: string;
  seniority?: Seniority;
  yearsRequired?: number;
  experienceRequirements?: string[];
  requiredCompetencyIds?: string[];
  otherSkills?: string[];
  workMode?: WorkMode;
  location?: string;
}

/**
 * O que a análise do anúncio muda no formulário. Só os campos para os quais
 * há resposta; competências e experiência juntam-se às que lá estavam (sem
 * repetir e dentro dos limites). Nada é gravado até se carregar em guardar.
 */
export function draftPatch(
  d: JobPostingDraft,
  current: {
    experience: string[];
    competencyIds: string[];
    otherSkills?: string[];
  },
): DraftPatch {
  const patch: DraftPatch = {};
  if (d.companyName) patch.companyName = d.companyName;
  if (d.jobTitle) patch.jobTitle = d.jobTitle;
  if (d.seniority !== 'UNKNOWN') patch.seniority = d.seniority;
  if (d.yearsRequired !== null) patch.yearsRequired = d.yearsRequired;
  if (d.experienceRequirements.length)
    patch.experienceRequirements = mergeUnique(
      current.experience,
      d.experienceRequirements,
    ).slice(0, APPLICATION_LIMITS.experienceItems);
  if (d.competencyIds.length)
    patch.requiredCompetencyIds = [
      ...new Set([...current.competencyIds, ...d.competencyIds]),
    ].slice(0, APPLICATION_LIMITS.competencies);
  if (d.otherSkills.length)
    patch.otherSkills = mergeUnique(
      current.otherSkills ?? [],
      d.otherSkills,
    ).slice(0, APPLICATION_LIMITS.otherSkills);
  if (d.workMode) patch.workMode = d.workMode;
  if (d.location) patch.location = d.location;
  return patch;
}

/** A mensagem depois de analisar: ok = a IA leu; senão, o aviso. */
export function describeDraft(d: JobPostingDraft): {
  ok: boolean;
  text: string;
} {
  if (d.source !== 'ai')
    return {
      ok: false,
      text: d.warnings[0] ?? 'Analisado sem IA, só por palavras-chave.',
    };
  const filled: string[] = [];
  if (d.companyName) filled.push('empresa');
  if (d.jobTitle) filled.push('título');
  if (d.seniority !== 'UNKNOWN') filled.push('senioridade');
  if (d.yearsRequired !== null) filled.push('anos');
  if (d.experienceRequirements.length) filled.push('experiência');
  if (d.competencyIds.length)
    filled.push(
      `${d.competencyIds.length} ${d.competencyIds.length === 1 ? 'competência' : 'competências'}`,
    );
  return {
    ok: true,
    text: filled.length
      ? `Preenchido: ${filled.join(', ')}. Confirma e ajusta se for preciso.`
      : 'A IA não encontrou dados neste texto. Confirma se é o anúncio certo.',
  };
}

/** Junta listas de texto sem repetir (ignora maiúsculas). */
export function mergeUnique(current: string[], extra: string[]): string[] {
  const seen = new Set(current.map((x) => x.toLowerCase()));
  const out = [...current];
  for (const x of extra) {
    if (seen.has(x.toLowerCase())) continue;
    seen.add(x.toLowerCase());
    out.push(x);
  }
  return out;
}

/** Um <input type="number"> vazio pode chegar como null, "" ou NaN. */
export function numberOrNull(v: unknown): number | null {
  return v === null || v === undefined || v === '' || Number.isNaN(Number(v))
    ? null
    : Number(v);
}
