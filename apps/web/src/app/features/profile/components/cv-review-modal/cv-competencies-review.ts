import { Component, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LEVELS, LEVEL_LABELS } from '@devstart/shared-types';
import { CatalogApiService } from '../../../../core/catalog/catalog-api.service';
import { CompetencyRow } from './cv-review';

/**
 * "Competências": as do catálogo encontradas no CV, com o nível sugerido (que
 * a pessoa ajusta) e onde foram encontradas. As que não estão no catálogo
 * ficam listadas por baixo, de fora.
 */
@Component({
  selector: 'ds-cv-competencies-review',
  imports: [FormsModule],
  template: `
    <section>
      <div class="d-flex justify-content-between align-items-baseline">
        <h3 class="h6">Competências ({{ rows().length }})</h3>
        <button
          type="button"
          class="btn btn-link btn-sm p-0"
          (click)="toggleAll()"
        >
          {{ allSelected() ? 'Desmarcar todas' : 'Marcar todas' }}
        </button>
      </div>
      <p class="small text-body-secondary mb-2">
        O nível é uma sugestão a partir do CV: ajusta ao que achas que sabes.
      </p>
      <div class="row g-2">
        @for (c of rows(); track c.value.competencyId) {
          @let name = catalog.nameOf(c.value.competencyId);
          <div class="col-md-6">
            <div
              class="d-flex align-items-center gap-2 border rounded-2 px-2 py-1"
              [class.opacity-50]="!c.selected"
            >
              <input
                class="form-check-input flex-shrink-0 m-0"
                type="checkbox"
                [(ngModel)]="c.selected"
                [attr.aria-label]="name"
              />
              <div class="flex-grow-1 small text-truncate">
                <span class="fw-medium">{{ name }}</span>
                @if (c.value.evidence.toLowerCase() !== name.toLowerCase()) {
                  <span
                    class="text-body-secondary"
                    [title]="'Encontrado em: ' + c.value.evidence"
                  >
                    · {{ c.value.evidence }}</span
                  >
                }
                @if (c.existing) {
                  <span class="text-body-secondary"> · já no perfil</span>
                }
              </div>
              <select
                class="form-select form-select-sm w-auto"
                [(ngModel)]="c.value.level"
                [disabled]="!c.selected"
                [attr.aria-label]="'Nível de ' + name"
              >
                @for (l of levels; track l) {
                  <option [value]="l">{{ levelLabels[l] }}</option>
                }
              </select>
            </div>
          </div>
        }
      </div>
      @if (unmatched().length) {
        <p class="small text-body-secondary mt-2 mb-0">
          <i class="bi bi-info-circle me-1"></i>Não estão no catálogo e ficam de
          fora: {{ unmatched().join(', ') }}.
        </p>
      }
    </section>
  `,
})
export class CvCompetenciesReview {
  protected readonly catalog = inject(CatalogApiService);

  readonly rows = input.required<CompetencyRow[]>();
  /** Competências do CV que não existem no catálogo. */
  readonly unmatched = input<string[]>([]);

  protected readonly levels = LEVELS;
  protected readonly levelLabels = LEVEL_LABELS;

  protected allSelected(): boolean {
    return this.rows().every((r) => r.selected);
  }

  protected toggleAll(): void {
    const value = !this.allSelected();
    this.rows().forEach((r) => (r.selected = value));
  }
}
