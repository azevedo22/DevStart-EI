import { Component } from '@angular/core';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';

/** Módulo 2 — competências declaradas e projetos (Proof of Work). Próximo passo. */
@Component({
  selector: 'ds-profile-page',
  imports: [EmptyState],
  template: `
    <div class="container py-4">
      <h1 class="h3">Perfil & Projetos</h1>
      <div class="card border-0 shadow-sm mt-3">
        <ds-empty-state
          icon="bi-person-workspace"
          title="Em construção"
          message="Aqui vais registar as tuas competências e os projetos que as demonstram."
        />
      </div>
    </div>
  `,
})
export class ProfilePage {}
