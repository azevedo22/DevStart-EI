import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivityEvent } from '@devstart/shared-types';
import { of, throwError } from 'rxjs';
import { ApplicationsStore } from '../../../applications/data/applications-store';
import { ProgressApi } from '../../data/progress-api';
import { ProgressPage } from './progress-page';

/** Quinta-feira, 29 de outubro de 2026: semana de 26/10 a 1/11. */
const TODAY = '2026-10-29';

const event = (date: string, kind: ActivityEvent['kind']): ActivityEvent =>
  ({
    date,
    kind,
    subject: 'Lumen Cloud',
    jobTitle: 'Junior Dev',
  }) as ActivityEvent;

describe('ProgressPage', () => {
  const render = async (
    activity: () => ReturnType<ProgressApi['activity']>,
  ) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ProgressApi, useValue: { activity: jest.fn(activity) } },
        { provide: ApplicationsStore, useValue: { today: signal(TODAY) } },
      ],
    });
    const fixture = TestBed.createComponent(ProgressPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { el, text: () => el.textContent!.replace(/\s+/g, ' ') };
  };

  it('mostra os totais com a comparação, o dia a dia e os objetivos', async () => {
    const { text } = await render(() =>
      of([
        event('2026-10-19', 'APPLIED'), // semana anterior
        event('2026-10-26', 'APPLIED'),
        event('2026-10-26', 'APPLIED'),
        event('2026-10-27', 'REJECTED'),
      ]),
    );
    const t = text();
    expect(t).toContain('esta semana');
    expect(t).toContain('+1 face à semana anterior');
    expect(t).toContain('Candidatura: Lumen Cloud (Junior Dev)');
    expect(t).toContain('Rejeição: Lumen Cloud (Junior Dev)');
    expect(t).toContain('Objetivos da semana');
    expect(t).toContain('2 / 15');
    // A meio da semana ainda não há reflexões.
    expect(t).not.toContain('Para refletir');
  });

  it('se a atividade não carregar, diz porquê', async () => {
    const { el } = await render(() =>
      throwError(() => ({ status: 500, message: 'Serviço em baixo.' })),
    );
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Serviço em baixo.',
    );
  });
});
