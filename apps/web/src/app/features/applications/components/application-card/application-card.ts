import { Component, computed, inject, input, output } from '@angular/core';
import {
  JobApplication,
  WORK_MODE_LABELS,
  matchWithProfile,
  silenceOf,
} from '@devstart/shared-types';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { matchClass } from '../../../../shared/ui/display';
import { ApplicationsStore } from '../../data/applications-store';
import { AccessibilityBadge } from '../accessibility-badge/accessibility-badge';

/** Cartão de uma candidatura no Kanban. */
@Component({
  selector: 'ds-application-card',
  imports: [AccessibilityBadge],
  template: `
    @let a = application();
    @if (compact()) {
      <button
        type="button"
        class="card-body text-start w-100 border-0 bg-transparent px-2 py-1"
        (click)="open.emit(a.id)"
        [attr.aria-label]="'Abrir ' + a.jobTitle + ' em ' + a.companyName"
      >
        <div class="d-flex justify-content-between gap-2 small">
          <span class="fw-semibold text-truncate">{{ a.companyName }}</span>
          @if (match().percentage !== null) {
            <span class="fw-semibold flex-shrink-0" [class]="matchClass()"
              >{{ match().percentage }}%</span
            >
          }
        </div>
        <div
          class="d-flex justify-content-between gap-2 small text-body-secondary"
        >
          <span class="text-truncate">{{ a.jobTitle }}</span>
          <span class="flex-shrink-0">
            @if (silence(); as s) {
              <i
                class="bi bi-hourglass-split text-warning-emphasis me-1"
                [title]="'Sem resposta há ' + s.days + ' dias'"
              ></i>
            }
            {{ daysAgo() }}
          </span>
        </div>
      </button>
    } @else {
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
        @if (silence(); as s) {
          <div
            class="silence badge fw-normal mt-2"
            [class.give-up]="s.stage === 'GIVE_UP'"
            [title]="
              s.stage === 'GIVE_UP'
                ? 'Já poucas empresas respondem: podes arquivar em Sem resposta'
                : 'Altura de um follow-up: abre para ver um rascunho'
            "
          >
            <i class="bi bi-hourglass-split me-1"></i>Sem resposta há
            {{ s.days }} dias
          </div>
        }
      </button>
    }
  `,
  styles: `
    .silence {
      color: var(--bs-warning-text-emphasis);
      background: var(--bs-warning-bg-subtle);
      border: 1px solid var(--bs-warning-border-subtle);
    }
    .silence.give-up {
      color: var(--bs-secondary-text-emphasis);
      background: var(--bs-secondary-bg-subtle);
      border-color: var(--bs-secondary-border-subtle);
    }
  `,
})
export class ApplicationCard {
  private readonly profile = inject(ProfileStore);
  private readonly store = inject(ApplicationsStore);

  readonly application = input.required<JobApplication>();
  /** Uma linha por candidatura: cabem muitas mais na coluna. */
  readonly compact = input(false);
  readonly open = output<string>();

  protected readonly workModes = WORK_MODE_LABELS;

  protected readonly silence = computed(() =>
    silenceOf(this.application(), this.store.today()),
  );

  protected readonly match = computed(() =>
    matchWithProfile(
      this.application().requiredCompetencyIds,
      this.profile.declaredIds(),
    ),
  );

  protected readonly matchClass = computed(() =>
    matchClass(this.match().percentage),
  );

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
