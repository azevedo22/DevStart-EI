import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivityEvent, dailyQuote } from '@devstart/shared-types';
import { of } from 'rxjs';
import { ProgressApi } from '../../../progress/data/progress-api';
import { ApplicationsStore } from '../../data/applications-store';
import { DailyQuote } from './daily-quote';

const FRIDAY = '2026-10-30';

const ev = (kind: ActivityEvent['kind']): ActivityEvent => ({
  date: FRIDAY,
  kind,
  subject: 'Empresa',
});

describe('DailyQuote', () => {
  const today = signal(FRIDAY);
  let events: ActivityEvent[] = [];
  const activity = jest.fn(() => of(events));

  const render = () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApplicationsStore,
          useValue: { today },
        },
        { provide: ProgressApi, useValue: { activity } },
      ],
    });
    const fixture = TestBed.createComponent(DailyQuote);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = () => {
      fixture.detectChanges();
      return el.textContent!.replace(/\s+/g, ' ');
    };
    return { el, text, fixture };
  };

  beforeEach(() => {
    localStorage.clear();
    today.set(FRIDAY);
    events = [];
    activity.mockClear();
  });

  it('mostra a frase do dia no original, com autor e fonte', () => {
    const q = dailyQuote(FRIDAY);
    const { el, text } = render();
    expect(text()).toContain(q.original);
    expect(text()).not.toContain(q.text);
    expect(el.querySelector('blockquote p')!.getAttribute('lang')).toBe('en');
    expect(text()).toContain(q.author);
    expect(el.querySelector('a')!.getAttribute('href')).toBe(q.source.url);
  });

  it('traduz para português a pedido e lembra a escolha', () => {
    const q = dailyQuote(FRIDAY);
    const { el, text } = render();
    const toggle = () =>
      (el.querySelector('figcaption button') as HTMLButtonElement).click();
    expect(text()).toContain('traduzir para português');
    toggle();
    expect(text()).toContain(q.text);
    expect(text()).toContain('ver original');
    TestBed.resetTestingModule();

    // No dia seguinte (nova visita), continua traduzida.
    const again = render();
    expect(again.text()).toContain(q.text);
    (again.el.querySelector('figcaption button') as HTMLButtonElement).click();
    expect(again.text()).toContain(q.original);
  });

  it('depois de uma rejeição recente, escolhe uma frase para isso', () => {
    events = [ev('APPLIED'), ev('REJECTED')];
    const { text } = render();
    // Procura nos últimos dias, pelo histórico do Kanban.
    expect(activity).toHaveBeenCalledWith('2026-10-28', FRIDAY);
    const q = dailyQuote(FRIDAY, 'rejection');
    expect(text()).toContain('Para depois de um «não»');
    expect(text()).toContain(q.original);
  });

  it('com uma resposta positiva recente, frase para a próxima fase', () => {
    events = [ev('RESPONSE_POSITIVE')];
    const { text } = render();
    expect(text()).toContain('Para a próxima fase');
    expect(text()).toContain(dailyQuote(FRIDAY, 'interview').original);
  });

  it('sem nada recente, num dia útil, não há rótulo', () => {
    events = [ev('APPLIED')];
    const { text } = render();
    expect(text()).not.toContain('Para ');
  });

  it('esconde até amanhã', () => {
    const { el, text } = render();
    (el.querySelector('.btn-close') as HTMLButtonElement).click();
    expect(text().trim()).toBe('');
    today.set('2026-10-31');
    expect(text()).toContain(dailyQuote('2026-10-31', 'weekend').original);
  });
});
