import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DailyGoalProgress, dailyGoalProgress } from '@devstart/shared-types';
import { ApplicationsStore } from '../../data/applications-store';
import { DailyGoal } from './daily-goal';

const TODAY = '2026-10-30';
const progress = (count: number) =>
  dailyGoalProgress(
    Array.from({ length: count }, () => TODAY),
    TODAY,
  );

describe('DailyGoal', () => {
  const goal = signal<DailyGoalProgress | null>(null);

  const render = () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ApplicationsStore,
          useValue: { dailyGoal: goal, load: jest.fn() },
        },
      ],
    });
    const fixture = TestBed.createComponent(DailyGoal);
    fixture.detectChanges();
    const text = () => {
      TestBed.tick();
      fixture.detectChanges();
      return (fixture.nativeElement as HTMLElement).textContent!.replace(
        /\s+/g,
        ' ',
      );
    };
    return { text };
  };

  beforeEach(() => goal.set(null));

  it('diz quanto falta para o próximo patamar', () => {
    goal.set(progress(4));
    const { text } = render();
    expect(text()).toContain('Faltam 3 para Bom');
    expect(text()).toContain('Suficiente');
  });

  it('no singular quando falta só uma', () => {
    goal.set(progress(6));
    const { text } = render();
    expect(text()).toContain('Falta 1 para Bom');
  });

  it('sem candidaturas, diz como começar', () => {
    goal.set(progress(0));
    const { text } = render();
    expect(text()).toContain(
      'Começa com 3 candidaturas para chegar a Suficiente',
    );
  });

  it('a 10 ou mais, o objetivo máximo está cumprido', () => {
    goal.set(progress(11));
    const { text } = render();
    expect(text()).toContain('Objetivo máximo de hoje cumprido');
  });

  it('celebra ao subir de patamar, mas não ao abrir a página', () => {
    goal.set(progress(7)); // já estava em Bom ao abrir
    const { text } = render();
    expect(text()).not.toContain('Chegaste a');

    goal.set(progress(8)); // continua em Bom
    expect(text()).not.toContain('Chegaste a');

    goal.set(progress(10)); // sobe para Muito bom
    expect(text()).toContain('Chegaste a Muito bom!');
  });
});
