import type { ApplicationStatus, InterviewType } from './application.types';

/**
 * "Recebi uma resposta": a pessoa cola o email da empresa e a IA diz que tipo
 * de resposta é, a que candidatura pertence e, se for o caso, quando é a
 * entrevista. Nada muda no quadro sem confirmação.
 */
export type ReplyKind =
  'REJECTION' | 'INTERVIEW' | 'TECHNICAL_TEST' | 'OFFER' | 'OTHER';

export const REPLY_KINDS: readonly ReplyKind[] = [
  'REJECTION',
  'INTERVIEW',
  'TECHNICAL_TEST',
  'OFFER',
  'OTHER',
];

export const REPLY_KIND_LABELS: Record<ReplyKind, string> = {
  REJECTION: 'Rejeição',
  INTERVIEW: 'Convite para entrevista',
  TECHNICAL_TEST: 'Teste técnico',
  OFFER: 'Proposta',
  OTHER: 'Outra resposta',
};

export const REPLY_LIMITS = {
  minText: 20,
  maxText: 10_000,
  /** Candidaturas enviadas como contexto (as abertas da pessoa). */
  maxCandidates: 200,
} as const;

/** Uma candidatura a que a resposta pode pertencer. */
export interface ReplyCandidate {
  id: string;
  companyName: string;
  jobTitle: string;
}

export interface AnalyzeReplyRequest {
  text: string;
  candidates: ReplyCandidate[];
  /** Hoje para a pessoa (AAAA-MM-DD): "na próxima terça" resolve-se a partir daqui. */
  today: string;
}

export interface ReplyDraft {
  /** 'ai' se a IA leu; 'keywords' se foi só por palavras-chave. */
  source: 'ai' | 'keywords';
  analyzedBy: string | null;
  sentToExternalService: boolean;
  warnings: string[];

  kind: ReplyKind;
  /** Uma das candidaturas enviadas, ou null se não se percebeu qual. */
  applicationId: string | null;
  /** Só para entrevistas: 'HR' ou 'TECHNICAL' (um teste é 'TEST'). */
  interviewType: InterviewType | null;
  /** Data e hora locais "AAAA-MM-DDTHH:mm", ou só a data "AAAA-MM-DD". */
  scheduledAt: string | null;
  /** Uma frase com o essencial, para a pessoa confirmar. */
  summary: string | null;
}

/** O que a resposta muda no quadro: a coluna e, se houver, a entrevista a registar. */
export interface ReplyAction {
  status: ApplicationStatus | null;
  interviewType: InterviewType | null;
}

export function replyAction(
  kind: ReplyKind,
  interviewType: InterviewType | null,
): ReplyAction {
  switch (kind) {
    case 'REJECTION':
      return { status: 'REJECTED', interviewType: null };
    case 'OFFER':
      return { status: 'OFFER', interviewType: null };
    case 'TECHNICAL_TEST':
      return { status: 'TECHNICAL_TEST', interviewType: 'TEST' };
    case 'INTERVIEW': {
      const type = interviewType === 'TECHNICAL' ? 'TECHNICAL' : 'HR';
      return {
        status: type === 'TECHNICAL' ? 'TECHNICAL_INTERVIEW' : 'HR_INTERVIEW',
        interviewType: type,
      };
    }
    case 'OTHER':
      return { status: null, interviewType: null };
  }
}
