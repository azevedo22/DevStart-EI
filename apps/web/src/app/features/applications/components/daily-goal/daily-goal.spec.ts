import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DailyGoalProgress, dailyGoalProgress } from '@devstart/shared-types';
import { ApplicationsStore } from '../../data/applications-store';
import { DailyGoal } from './daily-goal';

const TODAY = '2026-10-30'; // sexta-feira
const SATURDAY = '2026-10-31';
const progress = (count: number, today = TODAY) =>
  dailyGoalProgress(
    Array.from({ length: count }, () => today),
    today,
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
    goal.set(progress(1));
    const { text } = render();
    expect(text()).toContain('Falta 1 para Bom');
    expect(text()).toContain('Suficiente');
  });

  it('no plural quando faltam várias', () => {
    goal.set(dailyGoalProgress([], TODAY));
    const { text } = render();
    expect(text()).toContain('/ 3 candidaturas');
  });

  it('sem candidaturas, diz como começar', () => {
    goal.set(progress(0));
    const { text } = render();
    expect(text()).toContain(
      'Começa com 1 candidatura para chegar a Suficiente',
    );
  });

  it('a 3 ou mais, o objetivo máximo está cumprido', () => {
    goal.set(progress(4));
    const { text } = render();
    expect(text()).toContain('Objetivo máximo de hoje cumprido');
  });

  it('celebra ao subir de patamar, mas não ao abrir a página', () => {
    goal.set(progress(2)); // já estava em Bom ao abrir
    const { text } = render();
    expect(text()).not.toContain('Chegaste a');

    goal.set(progress(2)); // continua em Bom
    expect(text()).not.toContain('Chegaste a');

    goal.set(progress(3)); // sobe para Muito bom
    expect(text()).toContain('Chegaste a Muito bom!');
  });

  it('ao fim de semana não há objetivo e aponta para o relatório', () => {
    goal.set(progress(1, SATURDAY));
    const { text } = render();
    expect(text()).toContain('Fim de semana');
    expect(text()).toContain('Ver o relatório da semana');
    expect(text()).not.toContain('Falta');
    expect(text()).toContain('1 candidatura hoje');
  });
});
