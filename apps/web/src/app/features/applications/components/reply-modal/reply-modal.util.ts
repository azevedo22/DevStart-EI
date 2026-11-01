import {
  APPLICATION_STATUSES,
  ApplicationBoard,
  ApplicationStatus,
  InterviewType,
  JobApplication,
  ReplyCandidate,
  ReplyKind,
  replyAction,
} from '@devstart/shared-types';

/**
 * As candidaturas a que uma empresa pode estar a responder: as que estão à
 * espera ou em processo, e as que ficaram "Sem resposta" (uma resposta tardia
 * tira-as de lá). As guardadas ainda não foram enviadas; as de proposta ou
 * rejeição já tiveram resposta.
 */
const AWAITING: readonly ApplicationStatus[] = [
  'APPLIED',
  'TECHNICAL_TEST',
  'HR_INTERVIEW',
  'TECHNICAL_INTERVIEW',
  'NO_RESPONSE',
];

export function awaitsReply(status: ApplicationStatus): boolean {
  return AWAITING.includes(status);
}

export function replyCandidates(
  board: ApplicationBoard | null,
): JobApplication[] {
  if (!board) return [];
  return AWAITING.flatMap((s) => board[s]).sort((a, b) =>
    a.companyName.localeCompare(b.companyName, 'pt'),
  );
}

export function toCandidate(a: JobApplication): ReplyCandidate {
  return { id: a.id, companyName: a.companyName, jobTitle: a.jobTitle };
}

/** O que aplicar: para onde mover o cartão e que entrevista registar. */
export interface ReplyPlan {
  /** A coluna de destino, ou null se fica onde está. */
  moveTo: ApplicationStatus | null;
  /** Se mover é a sugestão (não é quando o cartão já está mais à frente). */
  moveSuggested: boolean;
  interviewType: InterviewType | null;
}

const STAGES: readonly ApplicationStatus[] = [
  'APPLIED',
  'TECHNICAL_TEST',
  'HR_INTERVIEW',
  'TECHNICAL_INTERVIEW',
];

export function replyPlan(
  kind: ReplyKind,
  interviewType: InterviewType | null,
  current: ApplicationStatus | null,
): ReplyPlan {
  const action = replyAction(kind, interviewType);
  const moveTo =
    action.status && action.status !== current ? action.status : null;
  // Um convite para entrevista de RH quando já se está na técnica não deve
  // fazer o cartão recuar; fica a escolha à pessoa.
  const behind =
    !!moveTo &&
    !!current &&
    STAGES.includes(moveTo) &&
    STAGES.includes(current) &&
    APPLICATION_STATUSES.indexOf(moveTo) <
      APPLICATION_STATUSES.indexOf(current);
  return {
    moveTo,
    moveSuggested: !!moveTo && !behind,
    interviewType: action.interviewType,
  };
}

/** "AAAA-MM-DDTHH:mm" ou "AAAA-MM-DD" → os valores dos campos de data e hora. */
export function splitScheduled(scheduledAt: string | null): {
  date: string;
  time: string;
} {
  if (!scheduledAt) return { date: '', time: '' };
  const [date, time = ''] = scheduledAt.split('T');
  return { date, time };
}

/** Os campos de data e hora (hora local) → ISO. Sem hora, fica às 09:00. */
export function scheduledIso(date: string, time: string): string | null {
  if (!date) return null;
  const d = new Date(`${date}T${time || '09:00'}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
