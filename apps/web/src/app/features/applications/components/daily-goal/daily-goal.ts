import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { GOAL_TIERS, GOAL_TIER_LABELS, GoalTier } from '@devstart/shared-types';
import { ApplicationsStore } from '../../data/applications-store';

const TIER_RANK: Record<GoalTier, number> = {
  SUFFICIENT: 1,
  GOOD: 2,
  EXCELLENT: 3,
};

/** Cor de cada patamar (classes do Bootstrap). */
const TIER_COLOR: Record<GoalTier, string> = {
  SUFFICIENT: 'info',
  GOOD: 'primary',
  EXCELLENT: 'success',
};

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/**
 * Objetivo diário de candidaturas: 3 é suficiente, 7 é bom, 10 é muito bom.
 * Barra com os três patamares, quanto falta para o próximo, sequência de dias
 * seguidos e os últimos 7 dias. Ao subir de patamar, há uma pequena celebração.
 */
@Component({
  selector: 'ds-daily-goal',
  imports: [RouterLink],
  template: `
    @if (progress(); as p) {
      <section
        class="card border-0 shadow-sm"
        aria-labelledby="daily-goal-title"
      >
        <div class="card-body p-4">
          <div
            class="d-flex flex-wrap justify-content-between align-items-start gap-2"
          >
            <div>
              <h2
                id="daily-goal-title"
                class="h6 text-body-secondary text-uppercase small mb-1"
              >
                <i class="bi bi-bullseye me-1"></i>Objetivo de hoje
              </h2>
              <div class="d-flex align-items-baseline gap-2">
                <span class="display-6 fw-semibold lh-1">{{
                  p.today.count
                }}</span>
                <span class="text-body-secondary">
                  / {{ p.max }}
                  {{ p.max === 1 ? p.goal.unit.one : p.goal.unit.many }}
                </span>
                @if (p.today.tier; as t) {
                  <span class="badge text-bg-{{ color(t) }} ms-1">
                    <i class="bi bi-award me-1"></i>{{ labels[t] }}
                  </span>
                }
              </div>
            </div>

            <div class="text-end">
              @if (p.streak > 0) {
                <div
                  class="fw-semibold"
                  [class.text-warning-emphasis]="p.streakIncludesToday"
                  [class.text-body-secondary]="!p.streakIncludesToday"
                  [title]="
                    p.streakIncludesToday
                      ? 'Dias seguidos com pelo menos 3 candidaturas'
                      : 'Chega a 3 hoje para manter a sequência'
                  "
                >
                  <i class="bi bi-fire me-1"></i>{{ p.streak }}
                  {{ p.streak === 1 ? 'dia seguido' : 'dias seguidos' }}
                </div>
              }
              <!-- Últimos 7 dias -->
              <div
                class="d-flex gap-1 mt-2 justify-content-end"
                aria-label="Últimos 7 dias"
              >
                @for (d of p.week; track d.date; let last = $last) {
                  <div class="text-center" [title]="d.date + ': ' + d.count">
                    <div
                      class="day rounded-1"
                      [class]="
                        d.tier ? 'bg-' + color(d.tier) : 'bg-body-secondary'
                      "
                      [class.today]="last"
                      [style.opacity]="d.tier ? 1 : d.count ? 0.6 : 0.35"
                    ></div>
                    <div class="tiny text-body-secondary">
                      {{ weekday(d.date) }}
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Barra com os patamares -->
          <div
            class="goal-bar mt-4"
            role="progressbar"
            [attr.aria-valuenow]="p.today.count"
            aria-valuemin="0"
            [attr.aria-valuemax]="p.max"
            [attr.aria-label]="
              'Candidaturas de hoje: ' + p.today.count + ' de ' + p.max
            "
          >
            <div class="goal-track">
              <div
                class="goal-fill bg-{{
                  p.today.tier ? color(p.today.tier) : 'secondary'
                }}"
                [style.width.%]="percent(p.today.count, p.max)"
              ></div>
            </div>
            @for (t of p.goal.tiers; track t.tier) {
              <div
                class="goal-mark"
                [style.left.%]="percent(t.target, p.max)"
                [class.reached]="p.today.count >= t.target"
              >
                <span
                  class="dot bg-{{
                    p.today.count >= t.target ? color(t.tier) : 'body-secondary'
                  }}"
                ></span>
                <span class="mark-label small">
                  <strong>{{ t.target }}</strong>
                  <!-- Em ecrãs estreitos os nomes não cabem; o selo e a mensagem já os dizem. -->
                  <span class="d-none d-sm-inline"> {{ labels[t.tier] }}</span>
                </span>
              </div>
            }
          </div>

          <div class="d-flex flex-wrap align-items-center gap-2 mt-4 pt-1">
            <p class="mb-0 me-auto" role="status">
              @if (celebration(); as c) {
                <span class="celebrate fw-semibold text-{{ color(c) }}">
                  <i class="bi bi-stars me-1"></i>Chegaste a {{ labels[c] }}!
                </span>
              } @else if (!p.next) {
                <span class="fw-semibold text-success">
                  <i class="bi bi-trophy me-1"></i>Objetivo máximo de hoje
                  cumprido.
                </span>
              } @else if (p.today.count === 0) {
                Começa com <strong>{{ p.next.missing }}</strong> candidaturas
                para chegar a <strong>{{ labels[p.next.tier] }}</strong
                >.
              } @else {
                {{ p.next.missing === 1 ? 'Falta' : 'Faltam' }}
                <strong>{{ p.next.missing }}</strong> para
                <strong>{{ labels[p.next.tier] }}</strong
                >.
              }
            </p>
            @if (showLink()) {
              <a
                routerLink="/applications"
                class="btn btn-sm btn-outline-primary"
              >
                <i class="bi bi-kanban me-1"></i>Ir para as candidaturas
              </a>
            }
          </div>
        </div>
      </section>
    }
  `,
  styles: `
    .day {
      width: 14px;
      height: 14px;
    }
    .day.today {
      outline: 2px solid var(--bs-body-color);
      outline-offset: 1px;
    }
    .tiny {
      font-size: 0.65rem;
    }
    .goal-bar {
      position: relative;
      padding-bottom: 1.6rem;
    }
    .goal-track {
      height: 0.75rem;
      border-radius: 1rem;
      background: var(--bs-secondary-bg);
      overflow: hidden;
    }
    .goal-fill {
      height: 100%;
      border-radius: 1rem;
      transition:
        width 0.4s ease,
        background-color 0.4s ease;
    }
    .goal-mark {
      position: absolute;
      top: -0.2rem;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .goal-mark:last-of-type {
      transform: translateX(-100%);
      align-items: flex-end;
    }
    .goal-mark .dot {
      width: 1.15rem;
      height: 1.15rem;
      border-radius: 50%;
      border: 3px solid var(--bs-body-bg);
      box-shadow: 0 0 0 1px var(--bs-border-color);
    }
    .mark-label {
      white-space: nowrap;
      color: var(--bs-secondary-color);
    }
    .goal-mark.reached .mark-label {
      color: var(--bs-body-color);
    }
    .celebrate {
      display: inline-block;
      animation: pop 0.5s ease-out;
    }
    @keyframes pop {
      0% {
        transform: scale(0.6);
        opacity: 0;
      }
      70% {
        transform: scale(1.12);
        opacity: 1;
      }
      100% {
        transform: scale(1);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .celebrate,
      .goal-fill {
        animation: none;
        transition: none;
      }
    }
  `,
})
export class DailyGoal {
  private readonly store = inject(ApplicationsStore);

  /** Mostra o atalho para o Kanban (útil fora da página de candidaturas). */
  readonly showLink = input(false);

  protected readonly labels = GOAL_TIER_LABELS;
  protected readonly progress = this.store.dailyGoal;
  /** Patamar acabado de atingir; desaparece ao fim de uns segundos. */
  protected readonly celebration = signal<GoalTier | null>(null);

  constructor() {
    this.store.load();

    // Celebra quando o patamar sobe, mas não ao abrir a página (já lá estava).
    let previous: GoalTier | null | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const tier = this.progress()?.today.tier ?? null;
      untracked(() => {
        if (
          previous !== undefined &&
          tier &&
          TIER_RANK[tier] > (previous ? TIER_RANK[previous] : 0)
        ) {
          this.celebration.set(tier);
          clearTimeout(timer);
          timer = setTimeout(() => this.celebration.set(null), 5000);
        }
        if (this.progress()) previous = tier;
      });
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }

  protected color(tier: GoalTier): string {
    return TIER_COLOR[tier];
  }

  protected percent(value: number, max: number): number {
    return Math.min(100, (value / max) * 100);
  }

  protected weekday(date: string): string {
    const [y, m, d] = date.split('-').map(Number);
    return WEEKDAYS[new Date(y, m - 1, d).getDay()];
  }
}
