import { Component, input } from '@angular/core';
import {
  GOAL_TIER_LABELS,
  WeeklyReport,
  describeDay,
} from '@devstart/shared-types';
import { GOAL_TIER_COLOR } from '../../../../shared/ui/display';
import { describeEvent, longDay } from '../../progress.util';

/**
 * A semana dia a dia: o patamar do objetivo, um resumo e o que aconteceu.
 * É também a versão em texto do gráfico.
 */
@Component({
  selector: 'ds-day-list',
  template: `
    <section class="card border-0 shadow-sm">
      <ul class="list-group list-group-flush">
        @for (d of report().days; track d.date) {
          <li class="list-group-item py-3" [class.bg-body-tertiary]="!d.active">
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
                    <i class="bi {{ x.icon }} text-body-secondary"></i>
                    <span>{{ x.text }}</span>
                  </li>
                }
              </ul>
            }
          </li>
        }
      </ul>
    </section>
  `,
})
export class DayList {
  readonly report = input.required<WeeklyReport>();

  protected readonly tierColor = GOAL_TIER_COLOR;
  protected readonly tierLabels = GOAL_TIER_LABELS;
  protected readonly longDay = longDay;
  protected readonly describe = describeDay;
  protected readonly describeEvent = describeEvent;
}
