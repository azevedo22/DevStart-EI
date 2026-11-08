import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { dailyGoalProgress } from '@devstart/shared-types';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApplicationsStore } from '../../data/applications-store';
import { WeekCelebration } from './week-celebration';

// Sábado, 7 de novembro de 2026: a semana começa na segunda, 2.
const SATURDAY = '2026-11-07';
const times = (date: string, n: number) =>
  Array.from({ length: n }, () => date);

describe('WeekCelebration', () => {
  const today = signal(SATURDAY);
  const dates = signal<string[]>([]);
  const user = signal({ id: 'u1' });

  const render = () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ApplicationsStore,
          useValue: {
            today,
            load: jest.fn(),
            dailyGoal: () => dailyGoalProgress(dates(), today()),
          },
        },
        { provide: AuthService, useValue: { user } },
      ],
    });
    const fixture = TestBed.createComponent(WeekCelebration);
    const el = fixture.nativeElement as HTMLElement;
    const text = () => {
      fixture.detectChanges();
      return el.textContent!.replace(/\s+/g, ' ').trim();
    };
    return { el, text, fixture };
  };

  beforeEach(() => {
    localStorage.clear();
    today.set(SATURDAY);
    user.set({ id: 'u1' });
  });

  it('não aparece antes de cumprir o objetivo', () => {
    dates.set(times('2026-11-04', 14));
    expect(render().text()).toBe('');
  });

  it('aparece ao cumprir, com as contas da semana', () => {
    dates.set([...times('2026-11-04', 10), ...times('2026-11-05', 5)]);
    expect(render().text()).toContain(
      'Objetivo da semana cumprido! 15 candidaturas esta semana (o objetivo era 15).',
    );
  });

  it('depois de fechada não volta nessa semana, mas volta na seguinte', () => {
    dates.set(times('2026-11-04', 15));
    const { el, text } = render();
    text();
    el.querySelector<HTMLButtonElement>('.btn-close')!.click();
    expect(text()).toBe('');

    // Nova semana com o objetivo outra vez cumprido.
    today.set('2026-11-13');
    dates.set(times('2026-11-10', 15));
    expect(text()).toContain('Objetivo da semana cumprido!');
  });

  it('fechar vale para cada utilizador', () => {
    dates.set(times('2026-11-04', 15));
    localStorage.setItem('devstart.weekGoal.celebratedOn.u1', '2026-11-02');
    const { text } = render();
    expect(text()).toBe('');
    user.set({ id: 'u2' });
    expect(text()).toContain('Objetivo da semana cumprido!');
  });
});
