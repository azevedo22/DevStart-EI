import { Component } from '@angular/core';
import {
  APPLICATION_STATUSES,
  ApplicationStatus,
} from '@devstart/shared-types';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';

/** Módulo 3 — quadro Kanban de candidaturas. As colunas já vêm dos tipos partilhados. */
@Component({
  selector: 'ds-kanban-page',
  imports: [EmptyState],
  template: `
    <div class="container-fluid py-4 px-md-4">
      <h1 class="h3 mb-3">Candidaturas</h1>
      <div class="d-flex gap-3 overflow-auto pb-2">
        @for (status of statuses; track status) {
          <section
            class="card border-0 shadow-sm flex-shrink-0"
            style="width: 16rem"
          >
            <header
              class="card-header bg-white fw-semibold small text-uppercase"
            >
              {{ labels[status] }}
            </header>
            <ds-empty-state icon="bi-inbox" title="Sem candidaturas" />
          </section>
        }
      </div>
    </div>
  `,
})
export class KanbanPage {
  protected readonly statuses = APPLICATION_STATUSES;
  protected readonly labels: Record<ApplicationStatus, string> = {
    APPLIED: 'Candidatado',
    TECHNICAL_TEST: 'Teste Técnico',
    HR_INTERVIEW: 'Entrevista RH',
    TECHNICAL_INTERVIEW: 'Entrevista Técnica',
    OFFER: 'Proposta',
    REJECTED: 'Rejeitado',
  };
}
