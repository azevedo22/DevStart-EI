import { Component, computed, input } from '@angular/core';
import { WeeklyReport } from '@devstart/shared-types';
import { reflections } from '../../progress.util';

/** "Para refletir": frases curtas tiradas dos números da semana. */
@Component({
  selector: 'ds-week-reflections',
  template: `
    <section class="card border-0 shadow-sm mb-3">
      <div class="card-body p-4">
        <h2 class="h6 text-body-secondary text-uppercase small mb-3">
          <i class="bi bi-lightbulb me-1"></i>Para refletir
        </h2>
        <ul class="small mb-0 ps-3">
          @for (line of lines(); track $index) {
            <li class="mb-2">{{ line }}</li>
          }
        </ul>
      </div>
    </section>
  `,
})
export class WeekReflections {
  readonly report = input.required<WeeklyReport>();

  protected readonly lines = computed(() => reflections(this.report()));
}
