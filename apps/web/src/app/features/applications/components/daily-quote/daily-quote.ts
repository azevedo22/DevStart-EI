import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  ActivityEvent,
  ActivityKind,
  QUOTE_CONTEXT_LABELS,
  addDays,
  dailyQuote,
  quoteContext,
} from '@devstart/shared-types';
import { catchError, of, switchMap } from 'rxjs';
import { ProgressApi } from '../../../progress/data/progress-api';
import { ApplicationsStore } from '../../data/applications-store';

const HIDDEN_KEY = 'devstart.dailyQuote.hiddenOn';
/** Quem pediu a tradução continua a vê-la nos dias seguintes. */
const LANG_KEY = 'devstart.dailyQuote.lang';
/** "Recente" = hoje, ontem ou anteontem. */
const RECENT_DAYS = 2;
const INTERVIEW_KINDS: readonly ActivityKind[] = [
  'RESPONSE_POSITIVE',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW',
];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sem armazenamento (ex.: janela privada): vale só nesta visita.
  }
}

/**
 * Frase do dia, de pessoas da tecnologia, com fonte, no original (inglês);
 * a tradução para português é a pedido, e a escolha fica lembrada. Depois de uma rejeição
 * ou com uma entrevista à porta, a frase acompanha o momento. Dá para
 * esconder até ao dia seguinte.
 */
@Component({
  selector: 'ds-daily-quote',
  template: `
    @if (!hidden()) {
      @let q = quote();
      <figure
        class="quote card border-0 shadow-sm mb-0"
        aria-label="Frase do dia"
      >
        <div class="card-body py-3 px-4 d-flex gap-3 align-items-start">
          <i class="bi bi-quote fs-2 text-primary lh-1" aria-hidden="true"></i>
          <div class="flex-grow-1" style="min-width: 0">
            @if (context(); as c) {
              <div class="small text-body-secondary text-uppercase tiny mb-1">
                {{ contextLabels[c] }}
              </div>
            }
            <blockquote class="mb-1 fs-6 fst-italic">
              <p class="mb-0" [attr.lang]="translated() ? 'pt' : 'en'">
                {{ translated() ? q.text : q.original }}
              </p>
            </blockquote>
            <figcaption class="small text-body-secondary mb-0">
              <strong class="text-body">{{ q.author }}</strong
              >, {{ q.role }}
              ·
              <a
                [href]="q.source.url"
                target="_blank"
                rel="noopener noreferrer"
                >{{ q.source.label }}</a
              >
              ·
              <button
                type="button"
                class="btn btn-link btn-sm p-0 align-baseline small"
                [attr.aria-pressed]="translated()"
                (click)="toggleTranslation()"
              >
                @if (translated()) {
                  ver original
                } @else {
                  <i class="bi bi-translate me-1"></i>traduzir para português
                }
              </button>
            </figcaption>
          </div>
          <button
            type="button"
            class="btn-close small"
            aria-label="Esconder a frase até amanhã"
            title="Esconder até amanhã"
            (click)="hide()"
          ></button>
        </div>
      </figure>
    }
  `,
  styles: `
    .quote {
      border-left: 3px solid var(--bs-primary) !important;
    }
    .tiny {
      font-size: 0.7rem;
      letter-spacing: 0.03em;
    }
    .btn-close {
      font-size: 0.6rem;
    }
  `,
})
export class DailyQuote {
  private readonly store = inject(ApplicationsStore);
  private readonly progress = inject(ProgressApi);

  protected readonly contextLabels = QUOTE_CONTEXT_LABELS;
  /** Por omissão, a frase nas palavras de quem a disse; a tradução é a pedido. */
  protected readonly translated = signal(read(LANG_KEY) === 'pt');
  private readonly hiddenOn = signal(read(HIDDEN_KEY));

  protected readonly hidden = computed(
    () => this.hiddenOn() === this.store.today(),
  );

  /**
   * O que aconteceu nos últimos dias, pelo histórico do Kanban (o mesmo do
   * relatório semanal): uma rejeição só conta se a candidatura passou mesmo a
   * "Rejeitado" agora, e não por se ter editado um cartão antigo.
   */
  private readonly recent = toSignal(
    toObservable(this.store.today).pipe(
      switchMap((today) =>
        this.progress
          .activity(addDays(today, -RECENT_DAYS), today)
          .pipe(catchError(() => of([] as ActivityEvent[]))),
      ),
    ),
    { initialValue: [] as ActivityEvent[] },
  );

  protected readonly context = computed(() => {
    const events = this.recent();
    return quoteContext({
      today: this.store.today(),
      recentRejection: events.some((e) => e.kind === 'REJECTED'),
      recentInterview: events.some((e) => INTERVIEW_KINDS.includes(e.kind)),
    });
  });

  protected readonly quote = computed(() =>
    dailyQuote(this.store.today(), this.context()),
  );

  protected hide(): void {
    const today = this.store.today();
    this.hiddenOn.set(today);
    write(HIDDEN_KEY, today);
  }

  protected toggleTranslation(): void {
    const next = !this.translated();
    this.translated.set(next);
    write(LANG_KEY, next ? 'pt' : 'original');
  }
}
