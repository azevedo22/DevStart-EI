import { Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ActivityEvent,
  WeeklyReport,
  addDays,
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
import { DayList } from '../../components/day-list/day-list';
import { WeekChart } from '../../components/week-chart/week-chart';
import { WeekGoals } from '../../components/week-goals/week-goals';
import { WeekReflections } from '../../components/week-reflections/week-reflections';
import { WeekTotals } from '../../components/week-totals/week-totals';
import { ProgressApi } from '../../data/progress-api';
import { shortDate } from '../../progress.util';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; events: ActivityEvent[] };

/**
 * Progresso da semana: navegação entre semanas, carregamento da atividade e a
 * disposição das peças (totais, gráfico, dia a dia, objetivos, reflexões).
 * Os textos e contas estão em progress.util.ts.
 */
@Component({
  selector: 'ds-progress-page',
  imports: [
    RouterLink,
    WeekChart,
    WeekTotals,
    DayList,
    WeekGoals,
    WeekReflections,
  ],
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
          <ds-week-totals [report]="r" />

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

              <ds-day-list [report]="r" />
            </div>

            <div class="col-lg-4">
              <ds-week-goals [goals]="r.goals" />

              @if (!isCurrent() || weekend()) {
                <ds-week-reflections [report]="r" />
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
})
export class ProgressPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ProgressApi);
  private readonly applications = inject(ApplicationsStore);

  protected readonly shortDate = shortDate;

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
