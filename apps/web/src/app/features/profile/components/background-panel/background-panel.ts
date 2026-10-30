import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BACKGROUND_LIMITS,
  EXPERIENCE_KIND_LABELS,
  Education,
  Experience,
  LANGUAGE_LEVELS,
  LANGUAGE_LEVEL_LABELS,
  LanguageLevel,
} from '@devstart/shared-types';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/http/error.interceptor';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { confirmAction } from '../../../../shared/components/confirm-modal/confirm-modal';
import { EducationFormModal } from '../education-form-modal/education-form-modal';
import { ExperienceFormModal } from '../experience-form-modal/experience-form-modal';

const MONTHS = [
  'jan.',
  'fev.',
  'mar.',
  'abr.',
  'mai.',
  'jun.',
  'jul.',
  'ago.',
  'set.',
  'out.',
  'nov.',
  'dez.',
];

/** Percurso: formação, experiência e línguas. */
@Component({
  selector: 'ds-background-panel',
  imports: [FormsModule],
  template: `
    <section class="card border-0 shadow-sm">
      <div class="card-body p-4">
        @if (error(); as e) {
          <div class="alert alert-danger py-2">{{ e }}</div>
        }
        <div class="row g-4">
          <!-- Formação -->
          <div class="col-lg-6">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h2 class="h5 mb-0">Formação</h2>
              <button
                type="button"
                class="btn btn-sm btn-light"
                (click)="openEducation()"
                aria-label="Adicionar formação"
              >
                <i class="bi bi-plus-lg"></i>
              </button>
            </div>
            @for (e of education(); track e.id) {
              <div class="d-flex gap-2 py-2 border-bottom item">
                <i class="bi bi-mortarboard text-primary mt-1"></i>
                <div class="flex-grow-1">
                  <div class="fw-medium">{{ e.degree }}</div>
                  <div class="small text-body-secondary">
                    {{ e.institution
                    }}{{ e.fieldOfStudy ? ' · ' + e.fieldOfStudy : '' }}
                  </div>
                  <div class="small text-body-secondary">
                    {{ years(e) }}
                  </div>
                </div>
                <div class="actions d-flex gap-1">
                  <button
                    type="button"
                    class="btn btn-sm btn-light"
                    (click)="openEducation(e)"
                    [attr.aria-label]="'Editar ' + e.degree"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-light text-danger"
                    (click)="removeEducation(e)"
                    [attr.aria-label]="'Apagar ' + e.degree"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            } @empty {
              <p class="small text-body-secondary mb-0">
                Ainda sem formação. Importa o CV ou adiciona à mão.
              </p>
            }
          </div>

          <!-- Experiência -->
          <div class="col-lg-6">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h2 class="h5 mb-0">Experiência</h2>
              <button
                type="button"
                class="btn btn-sm btn-light"
                (click)="openExperience()"
                aria-label="Adicionar experiência"
              >
                <i class="bi bi-plus-lg"></i>
              </button>
            </div>
            @for (e of experience(); track e.id) {
              <div class="d-flex gap-2 py-2 border-bottom item">
                <i class="bi bi-briefcase text-primary mt-1"></i>
                <div class="flex-grow-1">
                  <div class="fw-medium">
                    {{ e.role }}
                    <span class="badge text-bg-light fw-normal">{{
                      kindLabels[e.kind]
                    }}</span>
                  </div>
                  <div class="small text-body-secondary">
                    {{ e.organization }} · {{ period(e) }}
                  </div>
                  @if (e.description) {
                    <div class="small mt-1 description">
                      {{ e.description }}
                    </div>
                  }
                </div>
                <div class="actions d-flex gap-1">
                  <button
                    type="button"
                    class="btn btn-sm btn-light"
                    (click)="openExperience(e)"
                    [attr.aria-label]="'Editar ' + e.role"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-light text-danger"
                    (click)="removeExperience(e)"
                    [attr.aria-label]="'Apagar ' + e.role"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            } @empty {
              <p class="small text-body-secondary mb-0">
                Estágios, part-times e voluntariado contam. Importa o CV ou
                adiciona à mão.
              </p>
            }
          </div>

          <!-- Línguas -->
          <div class="col-12">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h2 class="h5 mb-0">Línguas</h2>
              @if (!editingLanguages()) {
                <button
                  type="button"
                  class="btn btn-sm btn-light"
                  (click)="editLanguages()"
                >
                  <i class="bi bi-pencil me-1"></i>Editar
                </button>
              }
            </div>
            @if (!editingLanguages()) {
              <div class="d-flex flex-wrap gap-2">
                @for (l of languages(); track l.language) {
                  <span
                    class="badge rounded-pill text-bg-light border fw-normal fs-6"
                  >
                    {{ l.language }}
                    <span class="text-body-secondary"
                      >· {{ shortLevel(l.level) }}</span
                    >
                  </span>
                } @empty {
                  <span class="small text-body-secondary"
                    >Ainda sem línguas.</span
                  >
                }
              </div>
            } @else {
              <div class="vstack gap-2" style="max-width: 32rem">
                @for (row of draftLanguages; track $index) {
                  <div class="d-flex gap-2">
                    <input
                      class="form-control form-control-sm"
                      placeholder="Língua"
                      [(ngModel)]="row.language"
                      [maxlength]="limits.language"
                      [attr.aria-label]="'Língua ' + ($index + 1)"
                    />
                    <select
                      class="form-select form-select-sm w-auto"
                      [(ngModel)]="row.level"
                      [attr.aria-label]="'Nível ' + ($index + 1)"
                    >
                      @for (lv of levels; track lv) {
                        <option [value]="lv">{{ levelLabels[lv] }}</option>
                      }
                    </select>
                    <button
                      type="button"
                      class="btn btn-sm btn-light text-danger"
                      (click)="draftLanguages.splice($index, 1)"
                      aria-label="Remover"
                    >
                      <i class="bi bi-x-lg"></i>
                    </button>
                  </div>
                }
                <div class="d-flex gap-2">
                  <button
                    type="button"
                    class="btn btn-sm btn-link px-0 me-auto"
                    [disabled]="
                      draftLanguages.length >= limits.languagesPerUser
                    "
                    (click)="draftLanguages.push({ language: '', level: 'B1' })"
                  >
                    <i class="bi bi-plus-lg me-1"></i>Adicionar língua
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-light"
                    (click)="editingLanguages.set(false)"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-primary"
                    [disabled]="saving()"
                    (click)="saveLanguages()"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .item:last-child {
      border-bottom: 0 !important;
    }
    .item .actions {
      opacity: 0.4;
      transition: opacity 0.15s;
    }
    .item:hover .actions,
    .item:focus-within .actions {
      opacity: 1;
    }
    .description {
      white-space: pre-line;
    }
  `,
})
export class BackgroundPanel {
  private readonly store = inject(ProfileStore);
  private readonly modals = inject(NgbModal);

  protected readonly limits = BACKGROUND_LIMITS;
  protected readonly kindLabels = EXPERIENCE_KIND_LABELS;
  protected readonly levels = LANGUAGE_LEVELS;
  protected readonly levelLabels = LANGUAGE_LEVEL_LABELS;

  protected readonly education = computed(
    () => this.store.profile()?.education ?? [],
  );
  protected readonly experience = computed(
    () => this.store.profile()?.experience ?? [],
  );
  protected readonly languages = computed(
    () => this.store.profile()?.languages ?? [],
  );

  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly editingLanguages = signal(false);
  protected draftLanguages: { language: string; level: LanguageLevel }[] = [];

  protected years(e: Education): string {
    if (!e.startYear && !e.endYear) return '';
    if (!e.endYear) return `${e.startYear} – em curso`;
    return e.startYear ? `${e.startYear} – ${e.endYear}` : `${e.endYear}`;
  }

  protected period(e: Experience): string {
    const fmt = (d: string) =>
      `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
    if (!e.startDate) return e.endDate ? `até ${fmt(e.endDate)}` : 'atual';
    return `${fmt(e.startDate)} – ${e.endDate ? fmt(e.endDate) : 'atual'}`;
  }

  protected shortLevel(level: LanguageLevel): string {
    return level === 'NATIVE' ? 'materna' : level;
  }

  openEducation(e: Education | null = null): void {
    const ref = this.modals.open(EducationFormModal, { centered: true });
    (ref.componentInstance as EducationFormModal).init(e);
  }

  openExperience(e: Experience | null = null): void {
    const ref = this.modals.open(ExperienceFormModal, {
      size: 'lg',
      centered: true,
    });
    (ref.componentInstance as ExperienceFormModal).init(e);
  }

  async removeEducation(e: Education): Promise<void> {
    if (
      !(await confirmAction(this.modals, {
        title: 'Apagar formação',
        message: `Apagar "${e.degree}"?`,
        confirmLabel: 'Apagar',
        danger: true,
      }))
    )
      return;
    this.store.deleteEducation(e.id).subscribe({
      error: (err: ApiError) => this.error.set(err.message),
    });
  }

  async removeExperience(e: Experience): Promise<void> {
    if (
      !(await confirmAction(this.modals, {
        title: 'Apagar experiência',
        message: `Apagar "${e.role}" em ${e.organization}?`,
        confirmLabel: 'Apagar',
        danger: true,
      }))
    )
      return;
    this.store.deleteExperience(e.id).subscribe({
      error: (err: ApiError) => this.error.set(err.message),
    });
  }

  editLanguages(): void {
    this.draftLanguages = this.languages().map((l) => ({ ...l }));
    if (!this.draftLanguages.length)
      this.draftLanguages.push({ language: 'Português', level: 'NATIVE' });
    this.editingLanguages.set(true);
  }

  saveLanguages(): void {
    const languages = this.draftLanguages
      .map((l) => ({ ...l, language: l.language.trim() }))
      .filter((l) => l.language.length >= 2);
    this.saving.set(true);
    this.error.set(null);
    this.store
      .saveLanguages(languages)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.editingLanguages.set(false),
        error: (e: ApiError) => this.error.set(e.message),
      });
  }
}
