import { Component, computed, inject, signal } from '@angular/core';
import { STATUS_LABELS } from '@devstart/shared-types';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ApplicationsStore } from '../../data/applications-store';
import { STAT_LISTS, StatList, statList } from '../../data/board-view';

/**
 * As candidaturas por trás de um número do topo do quadro. Clicar numa fecha
 * a lista e devolve o id, para o quadro abrir o detalhe.
 */
@Component({
  selector: 'ds-stat-list-modal',
  template: `
    @let info = lists[kind()];
    <div class="modal-header">
      <div>
        <h2 class="modal-title h5 mb-0">
          {{ info.title }}
          <span class="badge rounded-pill text-bg-light ms-1">{{
            items().length
          }}</span>
        </h2>
        <div class="small text-body-secondary">{{ info.hint }}</div>
      </div>
      <button
        type="button"
        class="btn-close"
        aria-label="Fechar"
        (click)="modal.dismiss()"
      ></button>
    </div>
    <div class="modal-body">
      @if (items().length) {
        <div class="list-group">
          @for (a of items(); track a.id) {
            <button
              type="button"
              class="list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-3"
              (click)="modal.close(a.id)"
            >
              <span class="text-truncate">
                <span class="fw-medium">{{ a.companyName }}</span>
                <span class="d-block small text-body-secondary text-truncate">{{
                  a.jobTitle
                }}</span>
              </span>
              <span class="text-end flex-shrink-0 small">
                <span class="badge text-bg-light border">{{
                  statusLabels[a.status]
                }}</span>
                <span class="d-block text-body-secondary mt-1">
                  {{ a.appliedAt.split('-').reverse().join('/') }}
                  @if (kind() === 'interviews') {
                    · {{ a.interviewCount }}
                    {{ a.interviewCount === 1 ? 'entrevista' : 'entrevistas' }}
                  }
                </span>
              </span>
            </button>
          }
        </div>
      } @else {
        <p class="text-body-secondary mb-0">{{ info.empty }}</p>
      }
    </div>
  `,
})
export class StatListModal {
  protected readonly modal = inject(NgbActiveModal);
  private readonly store = inject(ApplicationsStore);

  protected readonly lists = STAT_LISTS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly kind = signal<StatList>('total');
  protected readonly items = computed(() =>
    statList(this.store.board(), this.kind()),
  );

  init(kind: StatList): void {
    this.kind.set(kind);
  }
}
