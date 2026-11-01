import { Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FieldRow } from './cv-review';

/**
 * "Dados do perfil": cada campo lido do CV, editável, com o valor atual do
 * perfil por baixo quando vai ser substituído.
 */
@Component({
  selector: 'ds-cv-fields-review',
  imports: [FormsModule],
  template: `
    <section>
      <h3 class="h6">Dados do perfil</h3>
      <div class="vstack gap-2">
        @for (f of rows(); track f.key) {
          <div class="d-flex gap-2 align-items-start">
            <input
              class="form-check-input mt-2 flex-shrink-0"
              type="checkbox"
              [(ngModel)]="f.selected"
              [id]="'f-' + f.key"
              [attr.aria-label]="'Importar ' + f.label"
            />
            <div class="flex-grow-1">
              <label class="form-label small mb-1" [for]="'v-' + f.key">{{
                f.label
              }}</label>
              @if (f.key === 'bio') {
                <textarea
                  class="form-control form-control-sm"
                  rows="3"
                  [id]="'v-' + f.key"
                  [(ngModel)]="f.value"
                  [disabled]="!f.selected"
                ></textarea>
              } @else {
                <input
                  class="form-control form-control-sm"
                  [id]="'v-' + f.key"
                  [(ngModel)]="f.value"
                  [disabled]="!f.selected"
                />
              }
              @if (f.current) {
                <div class="form-text">
                  No perfil: <em>{{ f.current }}</em>
                  @if (f.selected) {
                    <span class="text-warning-emphasis">
                      · vai ser substituído</span
                    >
                  }
                </div>
              }
            </div>
          </div>
        }
      </div>
    </section>
  `,
})
export class CvFieldsReview {
  readonly rows = input.required<FieldRow[]>();
}
