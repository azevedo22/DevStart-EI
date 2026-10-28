import { Component, input } from '@angular/core';
import { ApplicationStats } from '@devstart/shared-types';

/** Números do processo de procura de emprego, no topo do quadro. */
@Component({
  selector: 'ds-board-stats',
  template: `
    @let s = stats();
    <div class="row g-3">
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body py-3">
            <div class="small text-body-secondary">Candidaturas</div>
            <div class="fs-4 fw-semibold">{{ s.total }}</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body py-3">
            <div class="small text-body-secondary">Em processo</div>
            <div class="fs-4 fw-semibold">{{ s.active }}</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body py-3">
            <div
              class="small text-body-secondary"
              title="Candidaturas que passaram da coluna Candidatado"
            >
              Taxa de resposta
            </div>
            <div class="fs-4 fw-semibold">
              {{ s.responseRate === null ? '—' : s.responseRate + '%' }}
            </div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body py-3">
            <div class="small text-body-secondary">Entrevistas</div>
            <div class="fs-4 fw-semibold">
              {{ s.interviews }}
              @if (s.offers) {
                <span class="fs-6 text-success ms-1"
                  >· {{ s.offers }}
                  {{ s.offers === 1 ? 'proposta' : 'propostas' }}</span
                >
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class BoardStats {
  readonly stats = input.required<ApplicationStats>();
}
