import { Component, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  EXPERIENCE_KIND_LABELS,
  LANGUAGE_LEVELS,
  LANGUAGE_LEVEL_LABELS,
  ORIGIN_LABELS,
  SaveEducationRequest,
  SaveExperienceRequest,
  SaveProjectRequest,
} from '@devstart/shared-types';
import { CatalogApiService } from '../../../../core/catalog/catalog-api.service';
import { LanguageRow, Row, period, years } from './cv-review';

/**
 * Formação, experiência, línguas e projetos lidos do CV: cada um com a sua
 * caixa para escolher e um aviso quando já existe no perfil.
 */
@Component({
  selector: 'ds-cv-items-review',
  imports: [FormsModule],
  template: `
    @if (education().length) {
      <section>
        <h3 class="h6">Formação</h3>
        <div class="vstack gap-2">
          @for (e of education(); track $index) {
            <label
              class="d-flex gap-2 border rounded-2 p-2 small"
              [class.opacity-50]="!e.selected"
            >
              <input
                class="form-check-input flex-shrink-0 mt-1"
                type="checkbox"
                [(ngModel)]="e.selected"
              />
              <span>
                <span class="fw-medium">{{ e.value.degree }}</span
                ><br />
                {{ e.value.institution }}
                <span class="text-body-secondary">{{ years(e.value) }}</span>
                @if (e.existing) {
                  <span class="text-body-secondary"> · já no perfil</span>
                }
              </span>
            </label>
          }
        </div>
      </section>
    }

    @if (experience().length) {
      <section>
        <h3 class="h6">Experiência</h3>
        <div class="vstack gap-2">
          @for (e of experience(); track $index) {
            <label
              class="d-flex gap-2 border rounded-2 p-2 small"
              [class.opacity-50]="!e.selected"
            >
              <input
                class="form-check-input flex-shrink-0 mt-1"
                type="checkbox"
                [(ngModel)]="e.selected"
              />
              <span>
                <span class="fw-medium">{{ e.value.role }}</span> ·
                {{ e.value.organization }}
                <span class="badge text-bg-light fw-normal ms-1">{{
                  kindLabels[e.value.kind]
                }}</span
                ><br />
                <span class="text-body-secondary">{{ period(e.value) }}</span>
                @if (e.value.description) {
                  <span class="d-block text-body-secondary">{{
                    e.value.description
                  }}</span>
                }
                @if (e.existing) {
                  <span class="text-body-secondary">Já no perfil.</span>
                }
              </span>
            </label>
          }
        </div>
      </section>
    }

    @if (languages().length) {
      <section>
        <h3 class="h6">Línguas</h3>
        <div class="d-flex flex-wrap gap-2">
          @for (l of languages(); track l.value.language) {
            <div
              class="d-flex align-items-center gap-2 border rounded-2 px-2 py-1"
              [class.opacity-50]="!l.selected"
            >
              <input
                class="form-check-input m-0"
                type="checkbox"
                [(ngModel)]="l.selected"
                [attr.aria-label]="l.value.language"
              />
              <span class="small fw-medium">{{ l.value.language }}</span>
              <select
                class="form-select form-select-sm w-auto"
                [(ngModel)]="l.value.level"
                [disabled]="!l.selected"
                [attr.aria-label]="'Nível de ' + l.value.language"
              >
                @for (lv of languageLevels; track lv) {
                  <option [value]="lv">{{ languageLevelLabels[lv] }}</option>
                }
              </select>
            </div>
          }
        </div>
      </section>
    }

    @if (projects().length) {
      <section>
        <h3 class="h6">Projetos</h3>
        <div class="vstack gap-2">
          @for (p of projects(); track $index) {
            <label
              class="d-flex gap-2 border rounded-2 p-2 small"
              [class.opacity-50]="!p.selected"
            >
              <input
                class="form-check-input flex-shrink-0 mt-1"
                type="checkbox"
                [(ngModel)]="p.selected"
              />
              <span>
                <span class="fw-medium">{{ p.value.title }}</span>
                <span class="badge text-bg-light fw-normal ms-1">{{
                  originLabels[p.value.origin]
                }}</span
                ><br />
                <span class="text-body-secondary">{{
                  p.value.description
                }}</span>
                @if (p.value.competencyIds.length) {
                  <span class="d-block mt-1">
                    @for (id of p.value.competencyIds; track id) {
                      <span
                        class="badge rounded-pill text-bg-primary fw-normal me-1"
                        >{{ catalog.nameOf(id) }}</span
                      >
                    }
                  </span>
                }
                @if (p.existing) {
                  <span class="text-body-secondary"
                    >Já existe um projeto com este nome.</span
                  >
                }
              </span>
            </label>
          }
        </div>
      </section>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class CvItemsReview {
  protected readonly catalog = inject(CatalogApiService);

  readonly education = input.required<Row<SaveEducationRequest>[]>();
  readonly experience = input.required<Row<SaveExperienceRequest>[]>();
  readonly languages = input.required<LanguageRow[]>();
  readonly projects = input.required<Row<SaveProjectRequest>[]>();

  protected readonly kindLabels = EXPERIENCE_KIND_LABELS;
  protected readonly originLabels = ORIGIN_LABELS;
  protected readonly languageLevels = LANGUAGE_LEVELS;
  protected readonly languageLevelLabels = LANGUAGE_LEVEL_LABELS;
  protected readonly years = years;
  protected readonly period = period;
}
