import { Component, input, output } from '@angular/core';
import { ApplicationStats } from '@devstart/shared-types';
import { StatList } from '../../data/board-view';

/**
 * Números do processo de procura de emprego, no topo do quadro. Cada um abre
 * a lista das candidaturas que conta, para nenhum número ficar por explicar.
 */
@Component({
  selector: 'ds-board-stats',
  template: `
    @let s = stats();
    <div class="row g-3">
      <div class="col-6 col-md-3">
        <button
          type="button"
          class="stat card border-0 shadow-sm h-100 w-100 text-start"
          aria-label="Ver as candidaturas"
          (click)="show.emit('total')"
        >
          <div class="card-body py-3">
            <div class="small text-body-secondary">Candidaturas</div>
            <div class="fs-4 fw-semibold">{{ s.total }}</div>
          </div>
        </button>
      </div>
      <div class="col-6 col-md-3">
        <button
          type="button"
          class="stat card border-0 shadow-sm h-100 w-100 text-start"
          aria-label="Ver as candidaturas em processo"
          (click)="show.emit('active')"
        >
          <div class="card-body py-3">
            <div class="small text-body-secondary">Em processo</div>
            <div class="fs-4 fw-semibold">{{ s.active }}</div>
          </div>
        </button>
      </div>
      <div class="col-6 col-md-3">
        <button
          type="button"
          class="stat card border-0 shadow-sm h-100 w-100 text-start"
          aria-label="Ver as candidaturas com resposta"
          (click)="show.emit('responses')"
        >
          <div class="card-body py-3">
            <div class="small text-body-secondary">Taxa de resposta</div>
            <div class="fs-4 fw-semibold">
              {{ s.responseRate === null ? '-' : s.responseRate + '%' }}
            </div>
          </div>
        </button>
      </div>
      <div class="col-6 col-md-3">
        <button
          type="button"
          class="stat card border-0 shadow-sm h-100 w-100 text-start"
          aria-label="Ver as candidaturas com entrevistas"
          (click)="show.emit('interviews')"
        >
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
        </button>
      </div>
    </div>
  `,
  styles: `
    .stat {
      transition:
        box-shadow 0.15s,
        transform 0.15s;
    }
    .stat:hover {
      box-shadow: var(--bs-box-shadow) !important;
    }
    .stat:hover .fs-4 {
      color: var(--bs-primary);
    }
  `,
})
export class BoardStats {
  readonly stats = input.required<ApplicationStats>();
  readonly show = output<StatList>();
}
