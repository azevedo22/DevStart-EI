import { ReplyCandidate } from '@devstart/shared-types';
import {
  guessCandidate,
  guessDateTime,
  guessKind,
  keywordReply,
  normalizeReply,
} from './reply-normalize';

const TODAY = '2026-11-02';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CANDIDATES: ReplyCandidate[] = [
  { id: A, companyName: 'Lumen Cloud', jobTitle: 'Junior Frontend Developer' },
  { id: B, companyName: 'Ribeira Tech', jobTitle: 'Junior Backend Developer' },
  { id: C, companyName: 'Ribeira Tech', jobTitle: 'QA Engineer' },
];

describe('guessKind', () => {
  it.each([
    ['Infelizmente decidimos avançar com outros candidatos.', 'REJECTION'],
    ['Unfortunately we will not be moving forward.', 'REJECTION'],
    ['Gostaríamos de te convidar para uma entrevista.', 'INTERVIEW'],
    ['Could you share your availability for a call?', 'INTERVIEW'],
    ['Segue em anexo o teste técnico, tens 5 dias.', 'TECHNICAL_TEST'],
    ['Please complete this HackerRank coding challenge.', 'TECHNICAL_TEST'],
    ['Temos o prazer de te enviar a proposta de trabalho.', 'OFFER'],
    ['Recebemos a tua candidatura, obrigado.', 'OTHER'],
  ])('%s → %s', (email, kind) => {
    expect(guessKind(email)).toBe(kind);
  });

  it('uma rejeição que fala da entrevista continua a ser rejeição', () => {
    expect(
      guessKind('Obrigado pela entrevista. Infelizmente não vamos avançar.'),
    ).toBe('REJECTION');
  });
});

describe('guessCandidate', () => {
  it('pela empresa, sem acentos nem maiúsculas a contar', () => {
    expect(
      guessCandidate('Olá! Aqui é a equipa da LUMEN CLOUD.', CANDIDATES),
    ).toBe(A);
  });

  it('duas vagas na mesma empresa: desempata pelo título', () => {
    expect(
      guessCandidate('Ribeira Tech — sobre a vaga de QA Engineer', CANDIDATES),
    ).toBe(C);
    expect(guessCandidate('Ribeira Tech: obrigado!', CANDIDATES)).toBeNull();
  });

  it('não confunde parte de uma palavra com a empresa', () => {
    expect(
      guessCandidate('Recebemos a tua candidatura.', [
        { id: A, companyName: 'Ab', jobTitle: 'Dev' },
      ]),
    ).toBeNull();
  });
});

describe('guessDateTime', () => {
  it('dia/mês e hora', () => {
    expect(guessDateTime('Entrevista a 12/11 às 10h30.', TODAY)).toBe(
      '2026-11-12T10:30',
    );
    expect(guessDateTime('Interview on 5/1/2027 at 14:00', TODAY)).toBe(
      '2027-01-05T14:00',
    );
  });

  it('sem ano e já passado: é o próximo ano (se não ficar longe demais)', () => {
    expect(guessDateTime('Entrevista a 20/01', TODAY)).toBe('2027-01-20');
  });

  it('datas impossíveis ou fora do intervalo ficam de fora', () => {
    expect(guessDateTime('a 31/02', TODAY)).toBeNull();
    expect(guessDateTime('a 12/11/2030', TODAY)).toBeNull();
    expect(guessDateTime('sem data', TODAY)).toBeNull();
  });
});

describe('normalizeReply', () => {
  it('aceita uma resposta válida', () => {
    const out = normalizeReply(
      {
        kind: 'INTERVIEW',
        candidateId: A,
        companyName: 'Lumen Cloud',
        interviewType: 'TECHNICAL',
        date: '2026-11-10',
        time: '15:00',
        summary: 'Entrevista técnica por videochamada.',
      },
      'email',
      CANDIDATES,
      TODAY,
    );
    expect(out).toEqual({
      kind: 'INTERVIEW',
      applicationId: A,
      interviewType: 'TECHNICAL',
      scheduledAt: '2026-11-10T15:00',
      summary: 'Entrevista técnica por videochamada.',
      warnings: [],
    });
  });

  it('id inventado: volta à empresa; data e hora inválidas ficam de fora', () => {
    const out = normalizeReply(
      {
        kind: 'TECHNICAL_TEST',
        candidateId: 'id-inventado',
        companyName: 'Lumen Cloud',
        interviewType: 'HR',
        date: '2026-13-40',
        time: '25:99',
        summary: null,
      },
      'Segue o desafio.',
      CANDIDATES,
      TODAY,
    );
    expect(out.applicationId).toBe(A);
    expect(out.interviewType).toBeNull();
    expect(out.scheduledAt).toBeNull();
  });

  it('hora inválida com data válida: fica só a data', () => {
    const out = normalizeReply(
      { kind: 'INTERVIEW', date: '2026-11-10', time: '9h' },
      'x',
      CANDIDATES,
      TODAY,
    );
    expect(out.scheduledAt).toBe('2026-11-10');
  });

  it('resposta disparatada: tipo pelas palavras-chave e aviso de candidatura', () => {
    const out = normalizeReply(
      { kind: 'PARABÉNS', date: 42 },
      'Infelizmente não vamos avançar.',
      CANDIDATES,
      TODAY,
    );
    expect(out.kind).toBe('REJECTION');
    expect(out.applicationId).toBeNull();
    expect(out.scheduledAt).toBeNull();
    expect(out.warnings[0]).toMatch(/Escolhe-a abaixo/);
  });

  it('rejeição não leva data nem tipo de entrevista', () => {
    const out = normalizeReply(
      { kind: 'REJECTION', interviewType: 'HR', date: '2026-11-10' },
      'x',
      CANDIDATES,
      TODAY,
    );
    expect(out.scheduledAt).toBeNull();
    expect(out.interviewType).toBeNull();
  });
});

describe('uma só candidatura (aberto no detalhe)', () => {
  it('a resposta é dessa, mesmo sem o nome da empresa no email', () => {
    const one = [CANDIDATES[1]];
    expect(
      normalizeReply({ kind: 'OFFER' }, 'Parabéns!', one, TODAY),
    ).toMatchObject({
      applicationId: B,
      warnings: [],
    });
    expect(keywordReply('Parabéns!', one, TODAY, 'x').applicationId).toBe(B);
  });
});

describe('keywordReply', () => {
  it('entrevista técnica com data, sem IA', () => {
    const out = keywordReply(
      'Olá, da Lumen Cloud: convidamos-te para uma entrevista técnica a 12/11 às 10:00.',
      CANDIDATES,
      TODAY,
      'a IA não respondeu',
    );
    expect(out).toMatchObject({
      kind: 'INTERVIEW',
      applicationId: A,
      interviewType: 'TECHNICAL',
      scheduledAt: '2026-11-12T10:00',
      summary: null,
    });
    expect(out.warnings[0]).toMatch(/sem IA \(a IA não respondeu\)/);
  });
});
