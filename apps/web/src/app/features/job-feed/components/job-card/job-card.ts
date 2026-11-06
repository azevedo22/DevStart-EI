import { Component, inject, input, output } from '@angular/core';
import {
  ApplicationStatus,
  JobFeedItem,
  WORK_MODE_LABELS,
} from '@devstart/shared-types';
import { CatalogApiService } from '../../../../core/catalog/catalog-api.service';
import { matchClass } from '../../../../shared/ui/display';
import { AccessibilityBadge } from '../../../applications/components/accessibility-badge/accessibility-badge';
import { ago, levelText } from '../../job-feed.util';

/**
 * Uma vaga do feed: o que pede, o match com o perfil e as ações. Só mostra e
 * avisa; quem decide o que acontece (abrir o anúncio, gravar no quadro) é a
 * página.
 *
 * "Candidatar-me" abre o anúncio e mostra a pergunta de confirmação: abrir o
 * anúncio não é candidatar-se, só "Sim, regista" cria o cartão.
 */
@Component({
  selector: 'ds-job-card',
  imports: [AccessibilityBadge],
  template: `
    @let j = job();
    <article class="card border-0 shadow-sm" [class.new-job]="isNew()">
      <div class="card-body">
        <div class="d-flex flex-wrap align-items-start gap-2">
          <div class="me-auto" style="min-width: 0">
            <h2 class="h6 mb-1">
              @if (isNew()) {
                <span class="badge text-bg-success me-1">Nova</span>
              }
              <a
                [href]="j.url"
                target="_blank"
                rel="noopener noreferrer"
                class="link-body-emphasis"
                >{{ j.title }}</a
              >
            </h2>
            <div class="small text-body-secondary">
              <strong class="text-body">{{ j.companyName }}</strong>
              @if (j.locations.length) {
                · <i class="bi bi-geo-alt"></i>
                {{ j.locations.join(', ') }}
              }
              @if (j.workMode) {
                · {{ workModeLabels[j.workMode] }}
              }
              · {{ ago(j.publishedAt) }}
            </div>
          </div>
          @if (j.matchPercentage !== null) {
            <div class="text-end">
              <div
                class="fs-5 fw-semibold lh-1"
                [class]="matchClass(j.matchPercentage)"
              >
                {{ j.matchPercentage }}%
              </div>
              <div class="tiny text-body-secondary">do teu perfil</div>
            </div>
          }
        </div>

        <div class="d-flex flex-wrap align-items-center gap-2 small mt-2">
          <ds-accessibility-badge
            [value]="j.accessibility"
            [mislabeled]="j.mislabeledJunior"
            [years]="j.yearsRequired"
          />
          @if (levelText(j); as t) {
            <span class="text-body-secondary">{{ t }}</span>
          }
        </div>

        <p class="small text-body-secondary mt-2 mb-2 summary">
          {{ j.summary }}
        </p>

        @if (j.competencyIds.length || j.outside.length) {
          <div class="d-flex flex-wrap gap-1 mb-2">
            @for (id of j.matched; track id) {
              <span class="badge rounded-pill text-bg-success fw-normal"
                ><i class="bi bi-check2 me-1"></i>{{ catalog.nameOf(id) }}</span
              >
            }
            @for (id of j.missing; track id) {
              <span class="badge rounded-pill text-bg-light border fw-normal">{{
                catalog.nameOf(id)
              }}</span>
            }
            @for (o of j.outside; track o) {
              <span
                class="badge rounded-pill text-bg-light border fw-normal"
                style="border-style: dashed !important"
                title="Fora do catálogo: conta como em falta"
                >{{ o }}</span
              >
            }
          </div>
        }
        @if (j.experienceRequirements.length) {
          <ul class="small mb-2 ps-3">
            @for (e of j.experienceRequirements.slice(0, 4); track $index) {
              <li>{{ e }}</li>
            }
          </ul>
        }

        <div class="d-flex flex-wrap align-items-center gap-2 pt-1">
          @if (inBoard(); as status) {
            <span class="badge text-bg-light border fw-normal py-2">
              <i class="bi bi-kanban me-1"></i>No teu quadro:
              {{ status === 'SAVED' ? 'por candidatar' : 'já te candidataste' }}
            </span>
            <a
              [href]="j.url"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-sm btn-link"
            >
              Ver anúncio
            </a>
          } @else if (confirming()) {
            <div
              class="confirm-box w-100 rounded-3 p-2 px-3 d-flex flex-wrap align-items-center gap-2"
              role="group"
              aria-label="Confirmar candidatura"
            >
              <span class="small me-auto">
                <i class="bi bi-question-circle me-1"></i>Concluíste a
                candidatura no ITJobs.pt?
              </span>
              <button
                type="button"
                class="btn btn-sm btn-success"
                [disabled]="busy()"
                (click)="applied.emit()"
              >
                <i class="bi bi-check2 me-1"></i>Sim, regista
              </button>
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary"
                [disabled]="busy()"
                (click)="saved.emit()"
              >
                <i class="bi bi-bookmark me-1"></i>Guardar para depois
              </button>
              <button
                type="button"
                class="btn btn-sm btn-link text-body-secondary"
                (click)="notYet.emit()"
              >
                Ainda não
              </button>
            </div>
          } @else {
            <button
              type="button"
              class="btn btn-sm btn-primary"
              [disabled]="busy()"
              (click)="openToApply.emit()"
              title="Abre o anúncio no ITJobs.pt. Só fica no teu quadro quando confirmares que te candidataste."
            >
              <i class="bi bi-box-arrow-up-right me-1"></i>Candidatar-me
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              [disabled]="busy()"
              (click)="saved.emit()"
            >
              <i class="bi bi-bookmark me-1"></i>Guardar para depois
            </button>
          }
          <span class="ms-auto tiny text-body-secondary">
            {{ j.analyzedBy === 'ai' ? 'Lida pela IA' : 'Triagem automática' }}
            · via ITJobs.pt
          </span>
        </div>
      </div>
    </article>
  `,
  styles: `
    .tiny {
      font-size: 0.72rem;
    }
    .summary {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .confirm-box {
      background: var(--bs-success-bg-subtle);
      border: 1px solid var(--bs-success-border-subtle);
    }
    .new-job {
      box-shadow:
        inset 3px 0 0 var(--bs-success),
        var(--bs-box-shadow-sm) !important;
    }
  `,
})
export class JobCard {
  protected readonly catalog = inject(CatalogApiService);

  readonly job = input.required<JobFeedItem>();
  /** Nova desde a última visita. */
  readonly isNew = input(false);
  /** Coluna do quadro onde a vaga já está (pelo link do anúncio), se estiver. */
  readonly inBoard = input<ApplicationStatus | undefined>(undefined);
  /** À espera de "Concluíste a candidatura?". */
  readonly confirming = input(false);
  /** A gravar no quadro: os botões ficam desligados. */
  readonly busy = input(false);

  /** "Candidatar-me": a página abre o anúncio (ainda no clique) e pergunta. */
  readonly openToApply = output<void>();
  readonly applied = output<void>();
  readonly saved = output<void>();
  readonly notYet = output<void>();

  protected readonly workModeLabels = WORK_MODE_LABELS;
  protected readonly ago = ago;
  protected readonly levelText = levelText;
  protected readonly matchClass = matchClass;
}
