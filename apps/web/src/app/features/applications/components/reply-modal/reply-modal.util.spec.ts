import {
  APPLICATION_STATUSES,
  ApplicationBoard,
  ApplicationStatus,
  JobApplication,
} from '@devstart/shared-types';
import {
  awaitsReply,
  replyCandidates,
  replyPlan,
  scheduledIso,
  splitScheduled,
} from './reply-modal.util';

const card = (
  id: string,
  status: ApplicationStatus,
  companyName: string,
): JobApplication => ({ id, status, companyName }) as JobApplication;

const board = (cards: JobApplication[]): ApplicationBoard =>
  Object.fromEntries(
    APPLICATION_STATUSES.map((s) => [s, cards.filter((c) => c.status === s)]),
  ) as ApplicationBoard;

describe('replyCandidates', () => {
  it('as enviadas à espera (e as sem resposta), por empresa', () => {
    const b = board([
      card('1', 'SAVED', 'Alfa'),
      card('2', 'APPLIED', 'Zeta'),
      card('3', 'HR_INTERVIEW', 'Beta'),
      card('4', 'REJECTED', 'Gama'),
      card('5', 'NO_RESPONSE', 'Ómega'),
      card('6', 'OFFER', 'Delta'),
    ]);
    expect(replyCandidates(b).map((a) => a.id)).toEqual(['3', '5', '2']);
    expect(replyCandidates(null)).toEqual([]);
  });

  it('awaitsReply', () => {
    expect(awaitsReply('APPLIED')).toBe(true);
    expect(awaitsReply('NO_RESPONSE')).toBe(true);
    expect(awaitsReply('SAVED')).toBe(false);
    expect(awaitsReply('REJECTED')).toBe(false);
  });
});

describe('replyPlan', () => {
  it('rejeição: move para Rejeitado, sem entrevista', () => {
    expect(replyPlan('REJECTION', null, 'APPLIED')).toEqual({
      moveTo: 'REJECTED',
      moveSuggested: true,
      interviewType: null,
    });
  });

  it('entrevista técnica: move e regista', () => {
    expect(replyPlan('INTERVIEW', 'TECHNICAL', 'HR_INTERVIEW')).toEqual({
      moveTo: 'TECHNICAL_INTERVIEW',
      moveSuggested: true,
      interviewType: 'TECHNICAL',
    });
  });

  it('já na coluna certa: não move, mas regista a entrevista', () => {
    expect(replyPlan('TECHNICAL_TEST', null, 'TECHNICAL_TEST')).toEqual({
      moveTo: null,
      moveSuggested: false,
      interviewType: 'TEST',
    });
  });

  it('não sugere recuar o cartão', () => {
    expect(replyPlan('INTERVIEW', 'HR', 'TECHNICAL_INTERVIEW')).toMatchObject({
      moveTo: 'HR_INTERVIEW',
      moveSuggested: false,
    });
  });

  it('uma resposta tardia tira o cartão de "Sem resposta"', () => {
    expect(replyPlan('INTERVIEW', 'HR', 'NO_RESPONSE')).toMatchObject({
      moveTo: 'HR_INTERVIEW',
      moveSuggested: true,
    });
  });

  it('outra resposta: nada a aplicar', () => {
    expect(replyPlan('OTHER', null, 'APPLIED')).toEqual({
      moveTo: null,
      moveSuggested: false,
      interviewType: null,
    });
  });
});

describe('datas', () => {
  it('splitScheduled', () => {
    expect(splitScheduled('2026-11-10T15:00')).toEqual({
      date: '2026-11-10',
      time: '15:00',
    });
    expect(splitScheduled('2026-11-10')).toEqual({
      date: '2026-11-10',
      time: '',
    });
    expect(splitScheduled(null)).toEqual({ date: '', time: '' });
  });

  it('scheduledIso: hora local; sem hora, às 09:00', () => {
    expect(scheduledIso('2026-11-10', '15:00')).toBe(
      new Date(2026, 10, 10, 15, 0).toISOString(),
    );
    expect(scheduledIso('2026-11-10', '')).toBe(
      new Date(2026, 10, 10, 9, 0).toISOString(),
    );
    expect(scheduledIso('', '10:00')).toBeNull();
  });
});
