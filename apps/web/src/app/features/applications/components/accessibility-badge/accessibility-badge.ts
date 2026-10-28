import { Component, computed, input } from '@angular/core';
import { ACCESSIBILITY_LABELS, Accessibility } from '@devstart/shared-types';

const STYLE: Record<Accessibility, { icon: string; css: string }> = {
  ENTRY_FRIENDLY: {
    icon: 'bi-door-open',
    css: 'text-bg-success-subtle text-success-emphasis',
  },
  STRETCH: {
    icon: 'bi-arrow-up-right',
    css: 'text-bg-info-subtle text-info-emphasis',
  },
  UNREALISTIC: {
    icon: 'bi-exclamation-triangle',
    css: 'text-bg-danger-subtle text-danger-emphasis',
  },
  UNKNOWN: {
    icon: 'bi-question-circle',
    css: 'text-bg-light text-body-secondary',
  },
};

/** Selo "esta vaga é acessível para quem tem 0 anos de experiência?". */
@Component({
  selector: 'ds-accessibility-badge',
  template: `
    <span class="badge fw-normal {{ style().css }}" [title]="title()">
      <i class="bi {{ style().icon }} me-1"></i>{{ label() }}
    </span>
    @if (mislabeled()) {
      <span
        class="badge fw-normal text-bg-warning-subtle text-warning-emphasis ms-1"
        title="Diz-se júnior, mas pede 3 ou mais anos de experiência"
      >
        <i class="bi bi-tag me-1"></i>"Júnior" só no nome
      </span>
    }
  `,
})
export class AccessibilityBadge {
  readonly value = input.required<Accessibility>();
  readonly mislabeled = input(false);
  readonly years = input<number | null>(null);

  protected readonly style = computed(() => STYLE[this.value()]);
  protected readonly label = computed(() => ACCESSIBILITY_LABELS[this.value()]);
  protected readonly title = computed(() => {
    const y = this.years();
    return y === null
      ? 'Anos de experiência não indicados'
      : y === 0
        ? 'Não exige experiência'
        : `Pede ${y}+ anos de experiência`;
  });
}
