import { DailyGoal } from '../../components/daily-goal/daily-goal';
import { DailyQuote } from '../../components/daily-quote/daily-quote';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ACCESSIBILITIES,
  ACCESSIBILITY_LABELS,
  APPLICATION_STATUSES,
  Accessibility,
  ApplicationStatus,
  JobApplication,
  STATUS_LABELS,
} from '@devstart/shared-types';
import { NgbModal, NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { ApplicationCard } from '../../components/application-card/application-card';
import { ApplicationDetail } from '../../components/application-detail/application-detail';
import { ApplicationFormModal } from '../../components/application-form-modal/application-form-modal';
import { BoardStats } from '../../components/board-stats/board-stats';
import { ApplicationsStore } from '../../data/applications-store';

const COLUMN_STYLE: Record<ApplicationStatus, string> = {
  SAVED: 'border-warning',
  APPLIED: 'border-secondary',
  TECHNICAL_TEST: 'border-info',
  HR_INTERVIEW: 'border-primary',
  TECHNICAL_INTERVIEW: 'border-primary',
  OFFER: 'border-success',
  REJECTED: 'border-danger',
  NO_RESPONSE: 'border-secondary-subtle',
};

/** Módulo 3 — quadro Kanban das candidaturas. */
@Component({
  selector: 'ds-kanban-page',
  imports: [
    FormsModule,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    ApplicationCard,
    BoardStats,
    EmptyState,
    DailyGoal,
    DailyQuote,
  ],
  template: `
    <div class="container-fluid py-4 px-3 px-md-4">
      <header
        class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3"
      >
        <div>
          <h1 class="h3 mb-0">Candidaturas</h1>
          <p class="text-body-secondary small mb-0">
            Arrasta os cartões entre colunas à medida que o processo avança.
          </p>
        </div>
        <button
          type="button"
          class="btn btn-primary"
          (click)="newApplication()"
        >
          <i class="bi bi-plus-lg me-1"></i>Nova candidatura
        </button>
      </header>

      @if (store.error(); as e) {
        <div
          class="alert alert-danger d-flex justify-content-between align-items-center"
        >
          <span>{{ e }}</span>
          <button
            type="button"
            class="btn btn-sm btn-outline-danger"
            (click)="store.load(true)"
          >
            Recarregar
          </button>
        </div>
      }

      <ds-daily-quote class="d-block mb-3" />
      <ds-daily-goal class="d-block mb-3" />

      @if (store.stats(); as stats) {
        <ds-board-stats [stats]="stats" class="d-block mb-3" />
      }

      @if (store.loaded() && store.total()) {
        <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
          <input
            type="search"
            class="form-control form-control-sm"
            style="max-width: 16rem"
            placeholder="Procurar empresa ou vaga…"
            aria-label="Procurar candidatura"
            [ngModel]="store.search()"
            (ngModelChange)="store.search.set($event)"
          />
          <div
            class="btn-group btn-group-sm flex-wrap"
            role="group"
            aria-label="Filtrar por acessibilidade"
          >
            <button
              type="button"
              class="btn"
              [class.btn-secondary]="!store.accessibilityFilter()"
              [class.btn-outline-secondary]="store.accessibilityFilter()"
              (click)="store.accessibilityFilter.set(null)"
            >
              Todas
            </button>
            @for (a of accessibilities; track a) {
              <button
                type="button"
                class="btn"
                [class.btn-secondary]="store.accessibilityFilter() === a"
                [class.btn-outline-secondary]="
                  store.accessibilityFilter() !== a
                "
                (click)="toggleFilter(a)"
              >
                {{ accessibilityLabels[a] }}
                <span class="badge text-bg-light ms-1">{{
                  store.stats()?.byAccessibility?.[a] ?? 0
                }}</span>
              </button>
            }
          </div>
          @if (store.filtersActive()) {
            <span class="small text-body-secondary"
              ><i class="bi bi-info-circle me-1"></i>Com filtros ativos,
              arrastar fica desligado.</span
            >
          }
        </div>
      }

      @if (!store.loaded()) {
        @if (store.loading()) {
          <div class="text-center py-5 text-body-secondary">
            <span
              class="spinner-border spinner-border-sm me-2"
              aria-hidden="true"
            ></span
            >A carregar o quadro…
          </div>
        }
      } @else if (!store.total()) {
        <div class="card border-0 shadow-sm">
          <ds-empty-state
            icon="bi-kanban"
            title="Ainda sem candidaturas"
            message="Regista a primeira vaga a que te candidataste. Podes colar o anúncio e as competências pedidas são detetadas automaticamente."
          />
          <div class="text-center pb-4">
            <button
              type="button"
              class="btn btn-primary"
              (click)="newApplication()"
            >
              Registar candidatura
            </button>
          </div>
        </div>
      } @else {
        <div class="board d-flex gap-3 overflow-auto pb-3" cdkDropListGroup>
          @for (status of statuses; track status) {
            @let cards = store.visibleBoard()[status];
            <section
              class="column card border-0 shadow-sm flex-shrink-0 border-top border-3 {{
                columnStyle[status]
              }}"
            >
              <header
                class="card-header bg-transparent d-flex justify-content-between align-items-center"
              >
                <h2 class="h6 mb-0 small text-uppercase fw-semibold">
                  {{ statusLabels[status] }}
                </h2>
                <span class="badge rounded-pill text-bg-light">{{
                  cards.length
                }}</span>
              </header>
              <div
                class="card-body p-2 vstack gap-2 drop-zone"
                cdkDropList
                [id]="status"
                [cdkDropListData]="cards"
                (cdkDropListDropped)="drop($event, status)"
                [attr.aria-label]="statusLabels[status]"
              >
                @for (card of cards; track card.id) {
                  <div
                    class="card kanban-card"
                    cdkDrag
                    [cdkDragData]="card"
                    [cdkDragDisabled]="store.filtersActive()"
                  >
                    <ds-application-card
                      [application]="card"
                      (open)="openDetail($event)"
                    />
                    <div
                      *cdkDragPlaceholder
                      class="card kanban-placeholder"
                    ></div>
                  </div>
                } @empty {
                  <p class="small text-body-secondary text-center my-3">
                    Sem candidaturas
                  </p>
                }
              </div>
            </section>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .column {
      width: 17.5rem;
      max-height: calc(100vh - 16rem);
      min-height: 14rem;
    }
    .drop-zone {
      overflow-y: auto;
      min-height: 6rem;
    }
    .kanban-card {
      cursor: grab;
      transition: box-shadow 0.15s;
    }
    .kanban-card:hover {
      box-shadow: var(--bs-box-shadow-sm);
    }
    .kanban-card.cdk-drag-disabled {
      cursor: pointer;
    }
    .kanban-placeholder {
      min-height: 5rem;
      border: 2px dashed var(--bs-primary-border-subtle);
      background: var(--bs-primary-bg-subtle);
    }
    .cdk-drag-preview {
      box-shadow: var(--bs-box-shadow);
      border-radius: var(--bs-border-radius);
    }
    .cdk-drag-animating,
    .drop-zone.cdk-drop-list-dragging .kanban-card:not(.cdk-drag-placeholder) {
      transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
    }
  `,
})
export class KanbanPage {
  protected readonly store = inject(ApplicationsStore);
  private readonly profile = inject(ProfileStore);
  private readonly modals = inject(NgbModal);
  private readonly offcanvas = inject(NgbOffcanvas);

  protected readonly statuses = APPLICATION_STATUSES;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly columnStyle = COLUMN_STYLE;
  protected readonly accessibilities = ACCESSIBILITIES;
  protected readonly accessibilityLabels = ACCESSIBILITY_LABELS;

  constructor() {
    this.store.load();
    this.profile.load(); // para a comparação com o perfil em cada cartão
  }

  drop(event: CdkDragDrop<JobApplication[]>, status: ApplicationStatus): void {
    const card = event.item.data as JobApplication;
    // Sem filtros, o índice visível é a posição real na coluna.
    this.store.move(card.id, status, event.currentIndex).catch(() => undefined);
  }

  toggleFilter(a: Accessibility): void {
    this.store.accessibilityFilter.set(
      this.store.accessibilityFilter() === a ? null : a,
    );
  }

  newApplication(): void {
    const ref = this.modals.open(ApplicationFormModal, {
      size: 'lg',
      scrollable: true,
      backdrop: 'static',
    });
    (ref.componentInstance as ApplicationFormModal).init(null);
  }

  openDetail(id: string): void {
    const ref = this.offcanvas.open(ApplicationDetail, {
      position: 'end',
      panelClass: 'detail-panel',
    });
    (ref.componentInstance as ApplicationDetail).init(id);
  }
}
