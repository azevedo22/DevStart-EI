import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  APPLICATION_STATUSES,
  ApplicationBoard,
  ApplicationStatus,
  JobApplication,
  ReplyDraft,
} from '@devstart/shared-types';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of, Subject } from 'rxjs';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { ApplicationsStore } from '../../data/applications-store';
import { ReplyApi } from '../../data/reply-api';
import { ReplyModal } from './reply-modal';

const LUMEN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RIBEIRA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EMAIL =
  'Olá! Da Lumen Cloud: convidamos-te para uma entrevista técnica a 10/11 às 15h.';

const card = (
  id: string,
  status: ApplicationStatus,
  companyName: string,
  jobTitle: string,
): JobApplication => ({ id, status, companyName, jobTitle }) as JobApplication;

const BOARD = Object.fromEntries(
  APPLICATION_STATUSES.map((s) => [s, [] as JobApplication[]]),
) as ApplicationBoard;
BOARD.APPLIED = [
  card(LUMEN, 'APPLIED', 'Lumen Cloud', 'Junior Frontend Developer'),
  card(RIBEIRA, 'APPLIED', 'Ribeira Tech', 'Junior Backend Developer'),
];

const draft = (patch: Partial<ReplyDraft> = {}): ReplyDraft => ({
  source: 'ai',
  analyzedBy: 'Groq · modelo',
  sentToExternalService: true,
  warnings: [],
  kind: 'INTERVIEW',
  applicationId: LUMEN,
  interviewType: 'TECHNICAL',
  scheduledAt: '2026-11-10T15:00',
  summary: 'Convite para entrevista técnica.',
  ...patch,
});

describe('ReplyModal', () => {
  let response: Subject<ReplyDraft>;
  const analyze = jest.fn();
  const move = jest.fn();
  const saveInterview = jest.fn();
  const close = jest.fn();

  const render = async (preselected: string | null = null) => {
    response = new Subject<ReplyDraft>();
    analyze.mockReset().mockReturnValue(response);
    move.mockReset().mockResolvedValue(undefined);
    saveInterview.mockReset().mockReturnValue(of({ id: 'i1' }));
    close.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: NgbActiveModal, useValue: { close, dismiss: jest.fn() } },
        { provide: ReplyApi, useValue: { analyze } },
        {
          provide: ApplicationsStore,
          useValue: {
            board: signal(BOARD),
            today: signal('2026-11-02'),
            move,
            saveInterview,
          },
        },
        {
          provide: ProfileStore,
          useValue: {
            cvReader$: of({ label: 'Groq · modelo', externalProvider: 'Groq' }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ReplyModal);
    fixture.componentInstance.init(preselected);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const text = () => el.textContent!.replace(/\s+/g, ' ');
    const button = (label: string) =>
      [...el.querySelectorAll('button')].find((b) =>
        b.textContent!.includes(label),
      ) as HTMLButtonElement;
    const paste = async (value: string) => {
      const area = el.querySelector('#replyText') as HTMLTextAreaElement;
      area.value = value;
      area.dispatchEvent(new Event('input'));
      await settle();
    };
    const value = (id: string) =>
      (el.querySelector(`#${id}`) as HTMLInputElement).value;
    return { el, settle, text, button, paste, value };
  };

  it('diz para onde vai o texto e não envia um texto curto', async () => {
    const { text, paste, button, settle } = await render();
    expect(text()).toContain('O texto é enviado para a Groq');
    await paste('Olá');
    button('Analisar').click();
    await settle();
    expect(analyze).not.toHaveBeenCalled();
    expect(text()).toContain('Cola primeiro o texto do email');
  });

  it('envia o email com as candidaturas e hoje; mostra a proposta', async () => {
    const { text, paste, button, settle, value } = await render();
    await paste(EMAIL);
    button('Analisar').click();
    await settle();
    expect(analyze).toHaveBeenCalledWith({
      text: EMAIL,
      today: '2026-11-02',
      candidates: [
        {
          id: LUMEN,
          companyName: 'Lumen Cloud',
          jobTitle: 'Junior Frontend Developer',
        },
        {
          id: RIBEIRA,
          companyName: 'Ribeira Tech',
          jobTitle: 'Junior Backend Developer',
        },
      ],
    });

    response.next(draft());
    await settle();
    expect(text()).toContain('Convite para entrevista técnica.');
    expect(value('replyKind')).toBe('INTERVIEW');
    expect(value('replyApp')).toBe(LUMEN);
    expect(value('replyDate')).toBe('2026-11-10');
    expect(value('replyTime')).toBe('15:00');
    expect(text()).toContain('Mover o cartão para Entrevista Técnica');
    expect(text()).toContain('Registar: Entrevista técnica');
  });

  it('só aplica ao confirmar: move e regista a entrevista', async () => {
    const { paste, button, settle } = await render();
    await paste(EMAIL);
    button('Analisar').click();
    response.next(draft());
    await settle();
    expect(move).not.toHaveBeenCalled();

    button('Aplicar').click();
    await settle();
    expect(move).toHaveBeenCalledWith(LUMEN, 'TECHNICAL_INTERVIEW', 0);
    expect(saveInterview).toHaveBeenCalledWith(LUMEN, {
      type: 'TECHNICAL',
      scheduledAt: new Date(2026, 10, 10, 15, 0).toISOString(),
      completed: false,
      outcome: 'PENDING',
      questionsAsked: [],
    });
    expect(close).toHaveBeenCalledWith({ applicationId: LUMEN });
  });

  it('sem candidatura identificada, "Aplicar" espera pela escolha', async () => {
    const { paste, button, settle, text } = await render();
    await paste('Infelizmente decidimos avançar com outros candidatos.');
    button('Analisar').click();
    response.next(
      draft({
        kind: 'REJECTION',
        applicationId: null,
        interviewType: null,
        scheduledAt: null,
        summary: null,
        warnings: ['Não percebi a que candidatura pertence esta resposta.'],
      }),
    );
    await settle();
    expect(text()).toContain('Não percebi a que candidatura');
    expect(button('Aplicar').disabled).toBe(true);
  });

  it('aberto no detalhe: envia só essa candidatura', async () => {
    const { paste, button, settle } = await render(RIBEIRA);
    await paste(EMAIL);
    button('Analisar').click();
    await settle();
    expect(analyze.mock.calls[0][0].candidates).toEqual([
      {
        id: RIBEIRA,
        companyName: 'Ribeira Tech',
        jobTitle: 'Junior Backend Developer',
      },
    ]);
  });
});
