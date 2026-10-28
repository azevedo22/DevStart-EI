import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  APPLICATION_STATUSES,
  ApplicationStatus,
  INTERVIEW_TYPE_LABELS,
  Interview,
  InterviewType,
  JobApplicationDetail,
  OUTCOME_LABELS,
  SENIORITY_LABELS,
  STATUS_LABELS,
  WORK_MODE_LABELS,
  matchWithProfile,
} from '@devstart/shared-types';
import { NgbActiveOffcanvas, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CatalogApiService } from '../../../../core/catalog/catalog-api.service';
import { ApiError } from '../../../../core/http/error.interceptor';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { confirmAction } from '../../../../shared/components/confirm-modal/confirm-modal';
import { ApplicationsStore } from '../../data/applications-store';
import { AccessibilityBadge } from '../accessibility-badge/accessibility-badge';
import { ApplicationFormModal } from '../application-form-modal/application-form-modal';
import { InterviewFormModal } from '../interview-form-modal/interview-form-modal';

/** Colunas que sugerem registar uma entrevista desse tipo ao entrar nelas. */
const STATUS_INTERVIEW: Partial<Record<ApplicationStatus, InterviewType>> = {
  TECHNICAL_TEST: 'TEST',
  HR_INTERVIEW: 'HR',
  TECHNICAL_INTERVIEW: 'TECHNICAL',
};

/**
 * Detalhe de uma candidatura (painel lateral): dados da vaga, comparação com o
 * perfil, linha temporal e entrevistas. Inclui um seletor de coluna como
 * alternativa ao arrastar, para teclado e telemóvel.
 */
@Component({
  selector: 'ds-application-detail',
  imports: [DatePipe, FormsModule, RouterLink, AccessibilityBadge],
  template: `
    <div class="offcanvas-header border-bottom">
      <div class="min-w-0">
        <h2 class="offcanvas-title h5 mb-0 text-truncate">
          {{ detail()?.companyName }}
        </h2>
        <div class="small text-body-secondary text-truncate">
          {{ detail()?.jobTitle }}
        </div>
      </div>
      <button
        type="button"
        class="btn-close"
        aria-label="Fechar"
        (click)="offcanvas.dismiss()"
      ></button>
    </div>

    <div class="offcanvas-body vstack gap-4">
      @if (error(); as e) {
        <div class="alert alert-danger py-2 mb-0">{{ e }}</div>
      }

      @if (detail(); as d) {
        <section>
          <label for="status" class="form-label small text-body-secondary mb-1"
            >Coluna</label
          >
          <select
            id="status"
            class="form-select"
            [ngModel]="d.status"
            (ngModelChange)="changeStatus($event)"
            [disabled]="busy()"
          >
            @for (s of statuses; track s) {
              <option [value]="s">{{ statusLabels[s] }}</option>
            }
          </select>
        </section>

        <section class="vstack gap-2">
          <ds-accessibility-badge
            [value]="d.accessibility"
            [mislabeled]="d.mislabeledJunior"
            [years]="d.yearsRequired"
          />
          <dl class="row small mb-0">
            <dt class="col-5 text-body-secondary fw-normal">Senioridade</dt>
            <dd class="col-7 mb-1">{{ seniorityLabels[d.seniority] }}</dd>
            <dt class="col-5 text-body-secondary fw-normal">
              Experiência pedida
            </dt>
            <dd class="col-7 mb-1">
              {{
                d.yearsRequired === null
                  ? 'Não indicada'
                  : d.yearsRequired === 0
                    ? 'Nenhuma'
                    : d.yearsRequired + '+ anos'
              }}
            </dd>
            <dt class="col-5 text-body-secondary fw-normal">Modalidade</dt>
            <dd class="col-7 mb-1">
              {{ workModeLabels[d.workMode]
              }}{{ d.location ? ' · ' + d.location : '' }}
            </dd>
            <dt class="col-5 text-body-secondary fw-normal">Candidatura</dt>
            <dd class="col-7 mb-1">{{ d.appliedAt | date: 'd MMM y' }}</dd>
          </dl>
          @if (d.jobUrl) {
            <a
              [href]="d.jobUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="small"
              ><i class="bi bi-box-arrow-up-right me-1"></i>Ver anúncio</a
            >
          }
          @if (d.notes) {
            <p
              class="small mb-0 text-body-secondary"
              style="white-space: pre-line"
            >
              {{ d.notes }}
            </p>
          }
        </section>

        @if (d.requiredCompetencyIds.length) {
          <section>
            <h3 class="h6">
              Comparação com o teu perfil
              <span class="badge text-bg-light ms-1"
                >{{ match().percentage }}%</span
              >
            </h3>
            <div class="d-flex flex-wrap gap-1">
              @for (id of match().matched; track id) {
                <span class="badge rounded-pill text-bg-success fw-normal"
                  ><i class="bi bi-check2 me-1"></i
                  >{{ catalog.nameOf(id) }}</span
                >
              }
              @for (id of match().missing; track id) {
                <span
                  class="badge rounded-pill text-bg-light border fw-normal"
                  >{{ catalog.nameOf(id) }}</span
                >
              }
            </div>
            @if (match().missing.length) {
              <p class="small text-body-secondary mt-2 mb-0">
                As que estão a cinzento não estão no teu perfil.
                <a routerLink="/profile" (click)="offcanvas.dismiss()"
                  >Atualizar perfil</a
                >
              </p>
            }
          </section>
        }

        <section>
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h3 class="h6 mb-0">Entrevistas</h3>
            <button
              type="button"
              class="btn btn-sm btn-outline-primary"
              (click)="openInterview(null)"
            >
              <i class="bi bi-plus-lg me-1"></i>Registar
            </button>
          </div>
          @for (i of d.interviews; track i.id) {
            <article class="border rounded-3 p-2 mb-2 small">
              <div
                class="d-flex justify-content-between align-items-start gap-2"
              >
                <div>
                  <span class="fw-medium">{{ interviewLabels[i.type] }}</span>
                  @if (i.scheduledAt) {
                    <span class="text-body-secondary">
                      · {{ i.scheduledAt | date: 'd MMM, HH:mm' }}</span
                    >
                  }
                  <div class="text-body-secondary">
                    {{ i.completed ? outcomeLabels[i.outcome] : 'Agendada' }}
                    @if (i.rating) {
                      ·
                      <span
                        class="text-warning"
                        [attr.aria-label]="i.rating + ' em 5'"
                        >{{ stars(i.rating) }}</span
                      >
                    }
                  </div>
                </div>
                <div class="d-flex gap-1">
                  <button
                    type="button"
                    class="btn btn-sm btn-light"
                    (click)="openInterview(i)"
                    aria-label="Editar entrevista"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-light text-danger"
                    (click)="deleteInterview(i)"
                    aria-label="Apagar entrevista"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
              @if (i.questionsAsked.length) {
                <ul class="mb-0 mt-1 ps-3">
                  @for (q of i.questionsAsked; track $index) {
                    <li>{{ q }}</li>
                  }
                </ul>
              }
            </article>
          } @empty {
            <p class="small text-body-secondary mb-0">
              Ainda sem entrevistas registadas.
            </p>
          }
        </section>

        <section>
          <h3 class="h6">Linha temporal</h3>
          <ol class="list-unstyled small mb-0 timeline">
            @for (h of d.history; track $index) {
              <li class="ps-3 pb-2 position-relative">
                <span class="fw-medium">{{ statusLabels[h.to] }}</span>
                <span class="text-body-secondary">
                  · {{ h.changedAt | date: 'd MMM y, HH:mm' }}</span
                >
              </li>
            }
          </ol>
        </section>

        <section class="d-flex gap-2 border-top pt-3">
          <button
            type="button"
            class="btn btn-outline-primary btn-sm"
            (click)="edit()"
          >
            <i class="bi bi-pencil me-1"></i>Editar
          </button>
          <button
            type="button"
            class="btn btn-outline-danger btn-sm ms-auto"
            (click)="remove()"
          >
            <i class="bi bi-trash me-1"></i>Apagar
          </button>
        </section>
      } @else {
        <div class="text-center text-body-secondary py-5">
          <span
            class="spinner-border spinner-border-sm"
            aria-hidden="true"
          ></span>
        </div>
      }
    </div>
  `,
  styles: `
    .min-w-0 {
      min-width: 0;
    }
    .timeline li::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0.4rem;
      width: 0.45rem;
      height: 0.45rem;
      border-radius: 50%;
      background: var(--bs-primary);
    }
    .timeline li:not(:last-child)::after {
      content: '';
      position: absolute;
      left: 0.19rem;
      top: 0.95rem;
      bottom: 0;
      width: 1px;
      background: var(--bs-border-color);
    }
  `,
})
export class ApplicationDetail {
  protected readonly offcanvas = inject(NgbActiveOffcanvas);
  protected readonly catalog = inject(CatalogApiService);
  private readonly profile = inject(ProfileStore);
  private readonly store = inject(ApplicationsStore);
  private readonly modals = inject(NgbModal);

  protected readonly statuses = APPLICATION_STATUSES;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly seniorityLabels = SENIORITY_LABELS;
  protected readonly workModeLabels = WORK_MODE_LABELS;
  protected readonly interviewLabels = INTERVIEW_TYPE_LABELS;
  protected readonly outcomeLabels = OUTCOME_LABELS;

  protected readonly detail = signal<JobApplicationDetail | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  private id!: string;

  protected readonly match = computed(() =>
    matchWithProfile(
      this.detail()?.requiredCompetencyIds ?? [],
      this.profile.declaredIds(),
    ),
  );

  init(id: string): void {
    this.id = id;
    this.reload();
  }

  protected stars(n: number): string {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  async changeStatus(status: ApplicationStatus): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.store.move(this.id, status, 0); // entra no topo da nova coluna
      this.reload();
      // Ao chegar a uma fase de entrevista, propõe registá-la.
      const type = STATUS_INTERVIEW[status];
      if (type && !this.detail()?.interviews.some((i) => i.type === type))
        this.openInterview(null, type);
    } catch (e) {
      this.error.set((e as ApiError).message);
    } finally {
      this.busy.set(false);
    }
  }

  openInterview(
    interview: Interview | null,
    defaultType?: InterviewType,
  ): void {
    const ref = this.modals.open(InterviewFormModal, {
      size: 'lg',
      scrollable: true,
      backdrop: 'static',
    });
    (ref.componentInstance as InterviewFormModal).init(
      this.id,
      interview,
      defaultType,
    );
    ref.result.then(
      () => this.reload(),
      () => undefined,
    );
  }

  async deleteInterview(interview: Interview): Promise<void> {
    const ok = await confirmAction(this.modals, {
      title: 'Apagar entrevista',
      message: 'O registo desta entrevista e as perguntas vão ser apagados.',
      confirmLabel: 'Apagar',
      danger: true,
    });
    if (!ok) return;
    this.store.deleteInterview(this.id, interview.id).subscribe({
      next: () => this.reload(),
      error: (e: ApiError) => this.error.set(e.message),
    });
  }

  edit(): void {
    const d = this.detail();
    if (!d) return;
    const ref = this.modals.open(ApplicationFormModal, {
      size: 'lg',
      scrollable: true,
      backdrop: 'static',
    });
    (ref.componentInstance as ApplicationFormModal).init(d);
    ref.result.then(
      () => this.reload(),
      () => undefined,
    );
  }

  async remove(): Promise<void> {
    const d = this.detail();
    if (!d) return;
    const ok = await confirmAction(this.modals, {
      title: 'Apagar candidatura',
      message: `A candidatura a "${d.jobTitle}" na ${d.companyName} vai ser apagada, com as entrevistas e o histórico.`,
      confirmLabel: 'Apagar',
      danger: true,
    });
    if (!ok) return;
    this.store.remove(this.id).subscribe({
      next: () => this.offcanvas.close('deleted'),
      error: (e: ApiError) => this.error.set(e.message),
    });
  }

  private reload(): void {
    this.store.detail(this.id).subscribe({
      next: (d) => this.detail.set(d),
      error: (e: ApiError) => this.error.set(e.message),
    });
  }
}
