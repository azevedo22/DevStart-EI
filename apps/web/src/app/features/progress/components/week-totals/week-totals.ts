import { Component, input } from '@angular/core';
import { REPORT_SERIES, WeeklyReport } from '@devstart/shared-types';
import { delta } from '../../progress.util';
import { SERIES_COLORS } from '../week-chart/week-chart';

/** Um cartão por série (candidaturas, respostas…) com a comparação à semana anterior. */
@Component({
  selector: 'ds-week-totals',
  template: `
    <div class="row g-3 mb-3">
      @for (s of series; track s.id) {
        <div class="col-6 col-md">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body py-3">
              <div
                class="small text-body-secondary d-flex align-items-center gap-1"
              >
                <span class="swatch" [style.background]="colors[s.id]"></span>
                {{ s.label }}
              </div>
              <div class="fs-3 fw-semibold lh-sm">
                {{ report().series[s.id] }}
              </div>
              <div class="small text-body-secondary">
                {{ delta(report(), s.id) }}
              </div>
            </div>
          </div>
        </div>
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
export class WeekTotals {
  readonly report = input.required<WeeklyReport>();

  protected readonly series = REPORT_SERIES;
  protected readonly colors = SERIES_COLORS;
  protected readonly delta = delta;
}
