import { Component, input, output } from '@angular/core';
import { APPLICATION_LIMITS } from '@devstart/shared-types';
import { mergeUnique } from '../application-form-modal/application-form.util';

/**
 * "Experiência pedida": uma lista curta de frases que se acrescentam (Enter ou
 * botão) e removem. Sem repetidos e com limite de itens e de tamanho.
 */
@Component({
  selector: 'ds-experience-list-editor',
  template: `
    <label for="experienceInput" class="form-label">Experiência pedida</label>
    @if (items().length) {
      <ul class="list-group mb-2">
        @for (e of items(); track $index) {
          <li
            class="list-group-item d-flex align-items-center gap-2 py-1 small"
          >
            <span class="me-auto">{{ e }}</span>
            <button
              type="button"
              class="btn-close"
              style="font-size: 0.6rem"
              [attr.aria-label]="'Remover ' + e"
              (click)="remove($index)"
            ></button>
          </li>
        }
      </ul>
    }
    @if (items().length < limits.experienceItems) {
      <div class="input-group input-group-sm">
        <input
          #experienceInput
          id="experienceInput"
          class="form-control"
          placeholder="Ex.: 1 ano a desenvolver APIs REST"
          [maxLength]="limits.experienceItem"
          (keydown.enter)="add(experienceInput); $event.preventDefault()"
        />
        <button
          type="button"
          class="btn btn-outline-secondary"
          (click)="add(experienceInput)"
        >
          Adicionar
        </button>
      </div>
    }
  `,
})
export class ExperienceListEditor {
  readonly items = input.required<string[]>();
  readonly itemsChange = output<string[]>();

  protected readonly limits = APPLICATION_LIMITS;

  protected add(input: HTMLInputElement): void {
    const value = input.value.replace(/\s+/g, ' ').trim();
    if (!value) return;
    this.itemsChange.emit(
      mergeUnique(this.items(), [value]).slice(
        0,
        APPLICATION_LIMITS.experienceItems,
      ),
    );
    input.value = '';
  }

  protected remove(index: number): void {
    this.itemsChange.emit(this.items().filter((_, i) => i !== index));
  }
}
