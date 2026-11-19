import type { ApplicationKind, ApplicationStatus } from './application.types';

/**
 * Quando é que o silêncio de uma empresa merece atenção.
 *
 * Quem responde, responde depressa: a mediana da primeira resposta ronda os
 * 7 dias (a maioria entre 4,5 e 8 dias), e recomenda-se o follow-up ao fim de
 * 1 a 2 semanas. Aos 14 dias (o dobro da mediana) sugere-se um follow-up;
 * aos 30, já poucas respostas chegam e propõe-se arquivar em "Sem resposta".
 * Fonte: Careery, "Job Application Response Time Benchmarks 2025"; The Muse.
 */
export const SILENCE = {
  followUpAfterDays: 14,
  giveUpAfterDays: 30,
} as const;

/**
 * Candidaturas espontâneas: as empresas respondem mais devagar (não há processo
 * aberto) e pedem muitas vezes para voltar a enviar mais tarde. Ao fim de um
 * mês sem resposta sugere-se reenviar; depois de 2 reenvios sem resposta,
 * propõe-se arquivar em "Sem resposta".
 */
export const SPONTANEOUS_SILENCE = {
  resendAfterDays: 30,
  maxResends: 2,
} as const;

/** FOLLOW_UP e GIVE_UP: vagas. RESEND: espontâneas (e GIVE_UP depois dos reenvios). */
export type SilenceStage = 'FOLLOW_UP' | 'RESEND' | 'GIVE_UP';

export interface Silence {
  /** Dias sem resposta, desde a candidatura (ou desde o último reenvio). */
  days: number;
  stage: SilenceStage;
}

const DAY = 86_400_000;

/** Dias entre duas datas AAAA-MM-DD (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY,
  );
}

/**
 * O silêncio de uma candidatura, ou null se ainda não há razão para avisar.
 * Só conta quem está à espera da primeira resposta ("Candidatado"): depois de
 * uma entrevista, o ritmo é outro e a pessoa sabe em que ponto está.
 */
export function silenceOf(
  app: {
    status: ApplicationStatus;
    appliedAt: string;
    kind?: ApplicationKind;
    resentOn?: readonly string[];
  },
  today: string,
): Silence | null {
  if (app.status !== 'APPLIED') return null;
  if (app.kind === 'SPONTANEOUS') {
    const resends = app.resentOn ?? [];
    const lastSent = resends.length
      ? resends[resends.length - 1]
      : app.appliedAt;
    const days = daysBetween(lastSent, today);
    if (days < SPONTANEOUS_SILENCE.resendAfterDays) return null;
    return {
      days,
      stage:
        resends.length >= SPONTANEOUS_SILENCE.maxResends ? 'GIVE_UP' : 'RESEND',
    };
  }
  const days = daysBetween(app.appliedAt, today);
  if (days >= SILENCE.giveUpAfterDays) return { days, stage: 'GIVE_UP' };
  if (days >= SILENCE.followUpAfterDays) return { days, stage: 'FOLLOW_UP' };
  return null;
}

export type FollowUpLanguage = 'pt' | 'en';

/** "12 de outubro" / "October 12". */
function longDate(date: string, lang: FollowUpLanguage): string {
  return new Intl.DateTimeFormat(lang === 'pt' ? 'pt-PT' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * Um follow-up curto e educado, pronto a copiar. Sem pressão nem desculpas:
 * reafirma o interesse e pede um ponto de situação.
 */
export function followUpDraft(
  app: { companyName: string; jobTitle: string; appliedAt: string },
  lang: FollowUpLanguage,
  senderName?: string | null,
): { subject: string; body: string } {
  const name = senderName?.trim();
  const when = longDate(app.appliedAt, lang);
  if (lang === 'en') {
    return {
      subject: `Following up on my application: ${app.jobTitle}`,
      body: [
        'Hello,',
        '',
        `I applied for the ${app.jobTitle} position at ${app.companyName} on ${when} and wanted to follow up on my application.`,
        `I remain very interested in the role and would be glad to share any further information that might help.`,
        '',
        'Could you let me know whether there are any updates on the process?',
        '',
        'Thank you for your time.',
        '',
        'Best regards,',
        name || '[o teu nome]',
      ].join('\n'),
    };
  }
  return {
    subject: `Candidatura a ${app.jobTitle}: ponto de situação`,
    body: [
      'Bom dia,',
      '',
      `Candidatei-me à vaga de ${app.jobTitle} na ${app.companyName} a ${when} e gostaria de saber se há novidades sobre o processo.`,
      'Continuo muito interessado(a) na oportunidade e estou disponível para enviar qualquer informação adicional que seja útil.',
      '',
      'Obrigado(a) pela atenção.',
      '',
      'Com os melhores cumprimentos,',
      name || '[o teu nome]',
    ].join('\n'),
  };
}

/**
 * O reenvio de uma candidatura espontânea, pronto a copiar: lembra o primeiro
 * envio, reafirma o interesse e volta a juntar o CV. Sem pressão nem desculpas.
 */
export function resendDraft(
  app: { companyName: string; jobTitle: string; appliedAt: string },
  lang: FollowUpLanguage,
  senderName?: string | null,
): { subject: string; body: string } {
  const name = senderName?.trim();
  const when = longDate(app.appliedAt, lang);
  const area = app.jobTitle.trim();
  if (lang === 'en') {
    return {
      subject: area
        ? `Unsolicited application: ${area}`
        : `Unsolicited application${name ? `: ${name}` : ''}`,
      body: [
        'Hello,',
        '',
        `On ${when} I sent ${app.companyName} an unsolicited application${area ? ` for ${area} roles` : ''}, and I would like to reaffirm my interest in joining your team.`,
        'I am attaching my updated CV and would be glad to talk whenever a suitable opportunity comes up.',
        '',
        'Thank you for your time.',
        '',
        'Best regards,',
        name || '[o teu nome]',
      ].join('\n'),
    };
  }
  return {
    subject: area
      ? `Candidatura espontânea: ${area}`
      : `Candidatura espontânea${name ? `: ${name}` : ''}`,
    body: [
      'Bom dia,',
      '',
      `A ${when} enviei à ${app.companyName} uma candidatura espontânea${area ? ` para a área de ${area}` : ''} e gostaria de reforçar o meu interesse em integrar a vossa equipa.`,
      'Junto o meu CV atualizado e fico disponível para conversar quando surgir uma oportunidade adequada.',
      '',
      'Obrigado(a) pela atenção.',
      '',
      'Com os melhores cumprimentos,',
      name || '[o teu nome]',
    ].join('\n'),
  };
}
