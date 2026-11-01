import { Component, computed, input, output } from '@angular/core';
import {
  JOB_CONTRACTS,
  JOB_LOCATIONS,
  JobFeedQuery,
  TargetStack,
} from '@devstart/shared-types';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ORDERED_LOCATIONS, filtersActive } from '../../job-feed.util';

/**
 * Barra de filtros das vagas: locais (ou remoto), contrato, stack alvo e as
 * pouco realistas. Não guarda estado: recebe a query e devolve a nova.
 */
@Component({
  selector: 'ds-job-filters',
  imports: [NgbDropdownModule],
  template: `
    <section class="card border-0 shadow-sm mb-3">
      <div class="card-body d-flex flex-wrap align-items-center gap-2">
        <div ngbDropdown [autoClose]="'outside'">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            ngbDropdownToggle
          >
            <i class="bi bi-geo-alt me-1"></i>{{ locationLabel() }}
          </button>
          <div ngbDropdownMenu class="p-2 locations-menu">
            <div class="form-check">
              <input
                class="form-check-input"
                type="checkbox"
                id="loc-remote"
                [checked]="query().remote"
                (change)="patch({ remote: !query().remote })"
              />
              <label class="form-check-label" for="loc-remote">
                <i class="bi bi-house-door me-1"></i>Remoto
              </label>
            </div>
            <hr class="my-2" />
            @for (l of locations; track l.id) {
              <div class="form-check">
                <input
                  class="form-check-input"
                  type="checkbox"
                  [id]="'loc-' + l.id"
                  [checked]="query().locations?.includes(l.id)"
                  (change)="toggle('locations', l.id)"
                />
                <label class="form-check-label" [for]="'loc-' + l.id">{{
                  l.name
                }}</label>
              </div>
            }
          </div>
        </div>

        <div ngbDropdown [autoClose]="'outside'">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            ngbDropdownToggle
          >
            <i class="bi bi-file-earmark-text me-1"></i>{{ contractLabel() }}
          </button>
          <div ngbDropdownMenu class="p-2">
            @for (c of contracts; track c.id) {
              <div class="form-check text-nowrap">
                <input
                  class="form-check-input"
                  type="checkbox"
                  [id]="'ct-' + c.id"
                  [checked]="query().contracts?.includes(c.id)"
                  (change)="toggle('contracts', c.id)"
                />
                <label class="form-check-label" [for]="'ct-' + c.id">{{
                  c.name
                }}</label>
              </div>
            }
          </div>
        </div>

        <select
          class="form-select form-select-sm w-auto"
          aria-label="Stack alvo"
          [value]="query().stackId ?? ''"
          (change)="patch({ stackId: $any($event.target).value || undefined })"
        >
          <option value="">Todas as stacks</option>
          @for (s of stacks(); track s.id) {
            <option [value]="s.id">{{ s.title }}</option>
          }
        </select>

        <div class="form-check form-switch ms-sm-auto mb-0">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="unrealistic"
            [checked]="query().includeUnrealistic"
            (change)="
              patch({ includeUnrealistic: !query().includeUnrealistic })
            "
          />
          <label class="form-check-label small" for="unrealistic"
            >Mostrar pouco realistas</label
          >
        </div>
        @if (active()) {
          <button
            type="button"
            class="btn btn-sm btn-link"
            (click)="queryChange.emit({})"
          >
            Limpar filtros
          </button>
        }
      </div>
    </section>
  `,
  styles: `
    .locations-menu {
      max-height: 22rem;
      overflow-y: auto;
    }
  `,
})
export class JobFilters {
  readonly query = input.required<JobFeedQuery>();
  readonly stacks = input<readonly TargetStack[]>([]);
  readonly queryChange = output<JobFeedQuery>();

  protected readonly locations = ORDERED_LOCATIONS;
  protected readonly contracts = JOB_CONTRACTS;
  protected readonly active = computed(() => filtersActive(this.query()));

  protected readonly locationLabel = computed(() => {
    const q = this.query();
    const names = (q.locations ?? []).map(
      (id) => JOB_LOCATIONS.find((l) => l.id === id)?.name ?? '',
    );
    if (q.remote) names.unshift('Remoto');
    if (!names.length) return 'Todo o país';
    return names.length <= 2 ? names.join(' ou ') : `${names.length} locais`;
  });

  protected readonly contractLabel = computed(() => {
    const ids = this.query().contracts ?? [];
    if (!ids.length) return 'Qualquer contrato';
    return ids.length === 1
      ? (JOB_CONTRACTS.find((c) => c.id === ids[0])?.name ?? '')
      : `${ids.length} contratos`;
  });

  protected patch(change: Partial<JobFeedQuery>): void {
    this.queryChange.emit({ ...this.query(), ...change });
  }

  protected toggle(key: 'locations' | 'contracts', id: number): void {
    const current = this.query()[key] ?? [];
    this.patch({
      [key]: current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id],
    });
  }
}
