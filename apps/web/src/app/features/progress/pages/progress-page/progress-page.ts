import { Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ActivityEvent,
  GOAL_TIER_LABELS,
  InterviewType,
  REPORT_SERIES,
  ReportSeriesId,
  STATUS_LABELS,
  WeeklyReport,
  addDays,
  describeDay,
  weekStart,
  weeklyReport,
} from '@devstart/shared-types';
import {
  catchError,
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { ApiError } from '../../../../core/http/error.interceptor';
import { ApplicationsStore } from '../../../applications/data/applications-store';
import {
  SERIES_COLORS,
  WeekChart,
} from '../../components/week-chart/week-chart';
import { ProgressApi } from '../../data/progress-api';
import { GOAL_TIER_COLOR } from '../../../../shared/ui/display';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; events: ActivityEvent[] };

/** "segunda-feira, 26 de out." */
export function longDay(date: string): string {
  const text = new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function shortDate(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

/** Uma linha por evento, para a lista do dia. */
export function describeEvent(e: ActivityEvent): {
  icon: string;
  text: string;
} {
  const job = e.jobTitle ? ` (${e.jobTitle})` : '';
  switch (e.kind) {
    case 'APPLIED':
      return { icon: 'bi-send', text: `Candidatura: ${e.subject}${job}` };
    case 'RESPONSE_POSITIVE':
      return {
        icon: 'bi-hand-thumbs-up',
        text: `Resposta positiva: ${e.subject} passou a ${e.status ? STATUS_LABELS[e.status] : 'outra fase'}`,
      };
    case 'OFFER':
      return { icon: 'bi-trophy', text: `Proposta: ${e.subject}${job}` };
    case 'REJECTED':
      return { icon: 'bi-x-circle', text: `Rejeição: ${e.subject}${job}` };
    case 'INTERVIEW_SCHEDULED': {
      const when = e.at
        ? new Intl.DateTimeFormat('pt-PT', {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(e.at))
        : null;
      return {
        icon: 'bi-calendar-plus',
        text: `Entrevista marcada: ${e.subject}${typeLabel(e)}${when ? `, ${when}` : ''}`,
      };
    }
    case 'INTERVIEW':
      return {
        icon: 'bi-people',
        text: `${e.round ? `${e.round}.ª entrevista` : 'Entrevista'}: ${e.subject}${typeLabel(e)}`,
      };
    case 'PROJECT_CREATED':
      return { icon: 'bi-plus-square', text: `Projeto novo: ${e.subject}` };
    case 'PROJECT_UPDATED':
      return {
        icon: 'bi-arrow-repeat',
        text: `Projeto atualizado: ${e.subject}`,
      };
  }
}

const INTERVIEW_SHORT: Record<InterviewType, string> = {
  HR: 'RH',
  TECHNICAL: 'técnica',
  TEST: 'teste técnico',
};

function typeLabel(e: ActivityEvent): string {
  return e.interviewType ? ` (${INTERVIEW_SHORT[e.interviewType]})` : '';
}

/**
 * Pontos para refletir no fim da semana: frases curtas tiradas dos números,
 * sem julgamentos. A semana a decorrer só tem estas notas ao fim de semana.
 */
export function reflections(r: WeeklyReport): string[] {
  const out: string[] = [];
  const apps = r.goals.find((g) => g.id === 'applications')!;
  const days = r.goals.find((g) => g.id === 'goal-days')!;

  if (apps.done) {
    out.push(`Objetivo da semana cumprido: ${apps.value} candidaturas.`);
  } else if (apps.value > 0) {
    const missing = apps.target - apps.value;
    out.push(
      `${apps.value} de ${apps.target} candidaturas: ${missing === 1 ? 'faltou 1' : `faltaram ${missing}`} para o objetivo da semana.`,
    );
  } else {
    out.push(
      'Nenhuma candidatura esta semana. Para a próxima, começa com 1 por dia útil.',
    );
  }

  if (days.value > 0 && !days.done)
    out.push(
      `Cumpriste o objetivo diário em ${days.value} de ${days.target} dias úteis.`,
    );

  const best = r.days
    .filter((d) => d.series.applications > 0)
    .sort((a, b) => b.series.applications - a.series.applications)[0];
  if (best && r.series.applications > 1)
    out.push(
      `O dia mais produtivo foi ${longDay(best.date).split(',')[0].toLowerCase()}, com ${best.series.applications} ${best.series.applications === 1 ? 'candidatura' : 'candidaturas'}.`,
    );

  if (r.series.positive > 0)
    out.push(
      `${r.series.positive === 1 ? 'Tiveste 1 resposta positiva' : `Tiveste ${r.series.positive} respostas positivas`}: prepara as próximas fases.`,
    );
  if (r.series.rejected > 0)
    out.push(
      `${r.series.rejected === 1 ? '1 rejeição' : `${r.series.rejected} rejeições`}: faz parte. Vê se há competências em comum nessas vagas.`,
    );
  if (r.series.projects === 0)
    out.push(
      'Nenhum projeto mexido: uma melhoria pequena num projeto também mostra trabalho.',
    );
  return out;
}

@Component({
  selector: 'ds-progress-page',
  imports: [RouterLink, WeekChart],
  template: `
    <div class="container py-4">
      <div
        class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3"
      >
        <div>
          <h1 class="h3 mb-0">Progresso da semana</h1>
          <p class="text-body-secondary mb-0">
            {{ shortDate(start()) }} a {{ shortDate(end()) }}
            @if (isCurrent()) {
              <span class="badge text-bg-light border ms-1">esta semana</span>
            }
          </p>
        </div>
        <nav class="btn-group" aria-label="Mudar de semana">
          <button
            type="button"
            class="btn btn-outline-secondary"
            (click)="go(-7)"
            aria-label="Semana anterior"
          >
            <i class="bi bi-chevron-left"></i>
          </button>
          <button
            type="button"
            class="btn btn-outline-secondary"
            [disabled]="isCurrent()"
            (click)="goToday()"
          >
            Esta semana
          </button>
          <button
            type="button"
            class="btn btn-outline-secondary"
            [disabled]="isCurrent()"
            (click)="go(7)"
            aria-label="Semana seguinte"
          >
            <i class="bi bi-chevron-right"></i>
          </button>
        </nav>
      </div>

      @if (weekend() && isCurrent()) {
        <div class="alert alert-primary d-flex gap-2 align-items-start">
          <i class="bi bi-cup-hot fs-5"></i>
          <div>
            <strong>Fim de semana: hora de olhar para trás.</strong> Sem
            objetivo hoje. Vê o que correu bem, o que ficou por fazer e prepara
            a semana que vem.
          </div>
        </div>
      }

      @switch (state().status) {
        @case ('loading') {
          <div class="text-center py-5 text-body-secondary" role="status">
            <span class="spinner-border spinner-border-sm me-2"></span>A
            carregar a semana…
          </div>
        }
        @case ('error') {
          <div class="alert alert-danger" role="alert">
            {{ errorMessage() }}
          </div>
        }
        @case ('ok') {
          @let r = report()!;
          <!-- Totais e comparação -->
          <div class="row g-3 mb-3">
            @for (s of series; track s.id) {
              <div class="col-6 col-md">
                <div class="card border-0 shadow-sm h-100">
                  <div class="card-body py-3">
                    <div
                      class="small text-body-secondary d-flex align-items-center gap-1"
                    >
                      <span
                        class="swatch"
                        [style.background]="colors[s.id]"
                      ></span>
                      {{ s.label }}
                    </div>
                    <div class="fs-3 fw-semibold lh-sm">
                      {{ r.series[s.id] }}
                    </div>
                    <div class="small text-body-secondary">
                      {{ delta(r, s.id) }}
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>

          <div class="row g-3">
            <div class="col-lg-8">
              <section class="card border-0 shadow-sm mb-3">
                <div class="card-body p-4">
                  <h2 class="h6 text-body-secondary text-uppercase small">
                    <i class="bi bi-bar-chart me-1"></i>Dia a dia
                  </h2>
                  <ds-week-chart [report]="r" [today]="today()" />
                </div>
              </section>

              <section class="card border-0 shadow-sm">
                <ul class="list-group list-group-flush">
                  @for (d of r.days; track d.date) {
                    <li
                      class="list-group-item py-3"
                      [class.bg-body-tertiary]="!d.active"
                    >
                      <div class="d-flex flex-wrap align-items-center gap-2">
                        <strong>{{ longDay(d.date) }}</strong>
                        @if (d.goalTier; as t) {
                          <span class="badge text-bg-{{ tierColor[t] }}">
                            <i class="bi bi-award me-1"></i>{{ tierLabels[t] }}
                          </span>
                        }
                        <span class="text-body-secondary small ms-auto">
                          @if (d.future) {
                            ainda não chegou
                          } @else if (describe(d.kinds); as text) {
                            {{ text }}
                          } @else if (d.active) {
                            sem atividade
                          } @else {
                            descanso
                          }
                        </span>
                      </div>
                      @if (d.events.length) {
                        <ul class="list-unstyled small mb-0 mt-2 ms-1">
                          @for (e of d.events; track $index) {
                            @let x = describeEvent(e);
                            <li class="d-flex gap-2 py-1">
                              <i
                                class="bi {{ x.icon }} text-body-secondary"
                              ></i>
                              <span>{{ x.text }}</span>
                            </li>
                          }
                        </ul>
                      }
                    </li>
                  }
                </ul>
              </section>
            </div>

            <div class="col-lg-4">
              <section class="card border-0 shadow-sm mb-3">
                <div class="card-body p-4">
                  <h2 class="h6 text-body-secondary text-uppercase small mb-3">
                    <i class="bi bi-flag me-1"></i>Objetivos da semana
                  </h2>
                  @for (g of r.goals; track g.id) {
                    <div class="mb-3">
                      <div class="d-flex justify-content-between small mb-1">
                        <span>
                          @if (g.done) {
                            <i
                              class="bi bi-check-circle-fill text-success me-1"
                            ></i>
                          }
                          {{ g.title }}
                        </span>
                        <span class="fw-semibold"
                          >{{ g.value }} / {{ g.target }}</span
                        >
                      </div>
                      <div
                        class="progress"
                        role="progressbar"
                        style="height: 0.6rem"
                        [attr.aria-label]="g.title"
                        [attr.aria-valuenow]="g.value"
                        aria-valuemin="0"
                        [attr.aria-valuemax]="g.target"
                      >
                        <div
                          class="progress-bar"
                          [class.bg-success]="g.done"
                          [style.width.%]="percent(g.value, g.target)"
                        ></div>
                      </div>
                    </div>
                  }
                  <p class="small text-body-secondary mb-0">
                    Objetivo diário nos dias úteis: 1 suficiente, 2 bom, 3 muito
                    bom.
                  </p>
                </div>
              </section>

              @if (!isCurrent() || weekend()) {
                <section class="card border-0 shadow-sm mb-3">
                  <div class="card-body p-4">
                    <h2
                      class="h6 text-body-secondary text-uppercase small mb-3"
                    >
                      <i class="bi bi-lightbulb me-1"></i>Para refletir
                    </h2>
                    <ul class="small mb-0 ps-3">
                      @for (line of reflections(r); track $index) {
                        <li class="mb-2">{{ line }}</li>
                      }
                    </ul>
                  </div>
                </section>
              }

              <div class="d-grid gap-2">
                <a routerLink="/applications" class="btn btn-outline-primary">
                  <i class="bi bi-kanban me-1"></i>Candidaturas
                </a>
                <a routerLink="/profile" class="btn btn-outline-secondary">
                  <i class="bi bi-folder2-open me-1"></i>Projetos no perfil
                </a>
              </div>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .swatch {
      display: inline-block;
      width: 0.7rem;
      height: 0.7rem;
      border-radius: 2px;
    }
  `,
})
export class ProgressPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ProgressApi);
  private readonly applications = inject(ApplicationsStore);

  protected readonly series = REPORT_SERIES;
  protected readonly colors = SERIES_COLORS;
  protected readonly tierColor = GOAL_TIER_COLOR;
  protected readonly tierLabels = GOAL_TIER_LABELS;
  protected readonly longDay = longDay;
  protected readonly shortDate = shortDate;
  protected readonly describe = describeDay;
  protected readonly describeEvent = describeEvent;
  protected readonly reflections = reflections;

  protected readonly today = this.applications.today;
  protected readonly weekend = computed(() =>
    [0, 6].includes(new Date(`${this.today()}T00:00:00Z`).getUTCDay()),
  );

  /** A segunda-feira pedida em ?semana=AAAA-MM-DD; sem ela, a de hoje. */
  private readonly requested = toSignal(
    this.route.queryParamMap.pipe(map((q) => q.get('semana'))),
    { initialValue: null },
  );
  protected readonly start = computed(() => {
    const thisWeek = weekStart(this.today());
    const q = this.requested();
    if (!q || !/^\d{4}-\d{2}-\d{2}$/.test(q)) return thisWeek;
    const s = weekStart(q);
    return s > thisWeek ? thisWeek : s;
  });
  protected readonly end = computed(() => addDays(this.start(), 6));
  protected readonly isCurrent = computed(
    () => this.start() === weekStart(this.today()),
  );

  // A semana e a anterior num só pedido, para a comparação.
  protected readonly state = toSignal(
    toObservable(this.start).pipe(
      distinctUntilChanged(),
      switchMap((start) => this.load(start)),
    ),
    { initialValue: { status: 'loading' } as LoadState },
  );

  protected readonly report = computed<WeeklyReport | null>(() => {
    const s = this.state();
    return s.status === 'ok'
      ? weeklyReport(s.events, this.start(), this.today())
      : null;
  });

  protected errorMessage(): string {
    const s = this.state();
    return s.status === 'error' ? s.message : '';
  }

  go(days: number): void {
    const target = addDays(this.start(), days);
    void this.router.navigate([], {
      queryParams: {
        semana: target === weekStart(this.today()) ? null : target,
      },
    });
  }

  goToday(): void {
    void this.router.navigate([], { queryParams: { semana: null } });
  }

  protected delta(r: WeeklyReport, id: ReportSeriesId): string {
    const diff = r.series[id] - r.previous.series[id];
    if (diff === 0) return 'igual à semana anterior';
    return `${diff > 0 ? '+' : '−'}${Math.abs(diff)} face à semana anterior`;
  }

  protected percent(value: number, target: number): number {
    return target ? Math.min(100, (value / target) * 100) : 0;
  }

  private load(start: string) {
    return this.api.activity(addDays(start, -7), addDays(start, 6)).pipe(
      map((events): LoadState => ({ status: 'ok', events })),
      catchError((e: ApiError) =>
        of<LoadState>({
          status: 'error',
          message: e.message || 'Não foi possível carregar a semana.',
        }),
      ),
      startWith<LoadState>({ status: 'loading' }),
    );
  }
}
