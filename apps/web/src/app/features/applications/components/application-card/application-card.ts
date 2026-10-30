import { Component, computed, inject, input, output } from '@angular/core';
import {
  JobApplication,
  WORK_MODE_LABELS,
  matchWithProfile,
} from '@devstart/shared-types';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { AccessibilityBadge } from '../accessibility-badge/accessibility-badge';

/** Cartão de uma candidatura no Kanban. */
@Component({
  selector: 'ds-application-card',
  imports: [AccessibilityBadge],
  template: `
    @let a = application();
    <button
      type="button"
      class="card-body text-start w-100 border-0 bg-transparent p-3"
      (click)="open.emit(a.id)"
      [attr.aria-label]="'Abrir ' + a.jobTitle + ' em ' + a.companyName"
    >
      <div class="d-flex justify-content-between gap-2">
        <span class="fw-semibold text-truncate">{{ a.companyName }}</span>
        @if (match().percentage !== null) {
          <span
            class="small fw-semibold flex-shrink-0"
            [class]="matchClass()"
            title="Competências da vaga que tens no perfil"
          >
            {{ match().percentage }}%
          </span>
        }
      </div>
      <div class="small text-body-secondary text-truncate mb-2">
        {{ a.jobTitle }}
      </div>
      <ds-accessibility-badge
        [value]="a.accessibility"
        [mislabeled]="a.mislabeledJunior"
        [years]="a.yearsRequired"
      />
      <div class="d-flex flex-wrap gap-2 small text-body-secondary mt-2">
        <span
          ><i class="bi bi-geo-alt me-1"></i
          >{{ a.location ? a.location + ' · ' : ''
          }}{{ workModes[a.workMode] }}</span
        >
        <span title="Data da candidatura"
          ><i class="bi bi-calendar3 me-1"></i>{{ daysAgo() }}</span
        >
        @if (a.interviewCount) {
          <span
            ><i class="bi bi-chat-dots me-1"></i>{{ a.interviewCount }}</span
          >
        }
      </div>
    </button>
  `,
})
export class ApplicationCard {
  private readonly profile = inject(ProfileStore);

  readonly application = input.required<JobApplication>();
  readonly open = output<string>();

  protected readonly workModes = WORK_MODE_LABELS;

  protected readonly match = computed(() =>
    matchWithProfile(
      this.application().requiredCompetencyIds,
      this.profile.declaredIds(),
    ),
  );

  protected readonly matchClass = computed(() => {
    const p = this.match().percentage ?? 0;
    return p >= 70
      ? 'text-success'
      : p >= 40
        ? 'text-warning-emphasis'
        : 'text-danger';
  });

  protected readonly daysAgo = computed(() => {
    const days = Math.floor(
      (Date.now() -
        new Date(this.application().appliedAt + 'T00:00:00').getTime()) /
        86_400_000,
    );
    // Em "Por candidatar", a data é a do dia em que foi guardada.
    const prefix = this.application().status === 'SAVED' ? 'guardada ' : '';
    if (days <= 0) return prefix + 'hoje';
    if (days === 1) return prefix + 'ontem';
    return (
      prefix +
      (days < 30
        ? `há ${days} dias`
        : `há ${Math.floor(days / 30)} ${days < 60 ? 'mês' : 'meses'}`)
    );
  });
}
