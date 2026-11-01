import { Component, input } from '@angular/core';
import { WeeklyGoal } from '@devstart/shared-types';
import { percent } from '../../progress.util';

/** Os objetivos da semana, cada um com a sua barra. */
@Component({
  selector: 'ds-week-goals',
  template: `
    <section class="card border-0 shadow-sm mb-3">
      <div class="card-body p-4">
        <h2 class="h6 text-body-secondary text-uppercase small mb-3">
          <i class="bi bi-flag me-1"></i>Objetivos da semana
        </h2>
        @for (g of goals(); track g.id) {
          <div class="mb-3">
            <div class="d-flex justify-content-between small mb-1">
              <span>
                @if (g.done) {
                  <i class="bi bi-check-circle-fill text-success me-1"></i>
                }
                {{ g.title }}
              </span>
              <span class="fw-semibold">{{ g.value }} / {{ g.target }}</span>
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
          Objetivo diário nos dias úteis: 1 suficiente, 2 bom, 3 muito bom.
        </p>
      </div>
    </section>
  `,
})
export class WeekGoals {
  readonly goals = input.required<WeeklyGoal[]>();

  protected readonly percent = percent;
}
