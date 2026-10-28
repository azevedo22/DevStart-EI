import { Component, input } from '@angular/core';

/** Bloco reutilizável para listas vazias e funcionalidades ainda por construir. */
@Component({
  selector: 'ds-empty-state',
  template: `
    <div class="text-center text-body-secondary py-5">
      <i class="bi {{ icon() }} display-5 d-block mb-3"></i>
      <h2 class="h5 text-body">{{ title() }}</h2>
      <p class="mb-0">{{ message() }}</p>
    </div>
  `,
})
export class EmptyState {
  readonly icon = input('bi-inbox');
  readonly title = input.required<string>();
  readonly message = input('');
}
