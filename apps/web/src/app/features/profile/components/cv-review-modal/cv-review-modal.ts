import { Component, inject, signal } from '@angular/core';
import { CvDraft, Profile, Project } from '@devstart/shared-types';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/http/error.interceptor';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { CvCompetenciesReview } from './cv-competencies-review';
import { CvFieldsReview } from './cv-fields-review';
import { CvItemsReview } from './cv-items-review';
import {
  CvReview,
  buildReview,
  importRequest,
  isEmpty,
  selectedCount,
} from './cv-review';

/**
 * Revisão do que a IA leu do CV. Nada é gravado até o utilizador confirmar.
 * O que vem marcado e o pedido final são decididos em cv-review.ts; cada
 * secção (dados, competências, formação/experiência/línguas/projetos) é um
 * componente próprio.
 */
@Component({
  selector: 'ds-cv-review-modal',
  imports: [CvFieldsReview, CvCompetenciesReview, CvItemsReview],
  template: `
    <div class="modal-header">
      <div>
        <h2 class="modal-title h5 mb-0">Rever o que foi lido do CV</h2>
        <div class="small text-body-secondary">
          Escolhe o que entra no teu perfil. Podes corrigir o texto aqui ou
          editar tudo mais tarde.
          @if (draft.analyzedBy) {
            <span class="d-block"
              ><i class="bi bi-stars me-1"></i>Lido por
              {{ draft.analyzedBy }}</span
            >
          }
        </div>
      </div>
      <button
        type="button"
        class="btn-close"
        aria-label="Fechar"
        (click)="modal.dismiss()"
      ></button>
    </div>

    <div class="modal-body vstack gap-4">
      @if (draft.sentToExternalService) {
        <div class="alert alert-info py-2 mb-0 small">
          <i class="bi bi-cloud-arrow-up me-1"></i>O CV foi enviado para um
          serviço de IA externo para ser lido. Os dados não ficam guardados no
          DevStart EI até confirmares a importação.
        </div>
      }
      @for (w of draft.warnings; track w) {
        <div class="alert alert-warning py-2 mb-0 small">
          <i class="bi bi-exclamation-triangle me-1"></i>{{ w }}
        </div>
      }

      @if (review.fields.length) {
        <ds-cv-fields-review [rows]="review.fields" />
      }
      @if (review.competencies.length) {
        <ds-cv-competencies-review
          [rows]="review.competencies"
          [unmatched]="draft.unmatchedSkills"
        />
      }
      <ds-cv-items-review
        [education]="review.education"
        [experience]="review.experience"
        [languages]="review.languages"
        [projects]="review.projects"
      />

      @if (isEmpty(review)) {
        <p class="text-body-secondary mb-0">
          Não encontrei nada para importar neste CV.
        </p>
      }
    </div>

    <div class="modal-footer">
      @if (error(); as e) {
        <div class="text-danger small me-auto" role="alert">{{ e }}</div>
      }
      <button type="button" class="btn btn-light" (click)="modal.dismiss()">
        Cancelar
      </button>
      @let count = selectedCount(review);
      <button
        type="button"
        class="btn btn-primary"
        [disabled]="!count || saving()"
        (click)="import()"
      >
        @if (saving()) {
          <span
            class="spinner-border spinner-border-sm me-2"
            aria-hidden="true"
          ></span>
        }
        Importar {{ count }}
        {{ count === 1 ? 'item' : 'itens' }}
      </button>
    </div>
  `,
})
export class CvReviewModal {
  protected readonly modal = inject(NgbActiveModal);
  private readonly store = inject(ProfileStore);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly isEmpty = isEmpty;
  protected readonly selectedCount = selectedCount;

  protected draft!: CvDraft;
  protected review!: CvReview;

  /** Chamado por quem abre o modal. */
  init(draft: CvDraft, profile: Profile | null, projects: Project[]): void {
    this.draft = draft;
    this.review = buildReview(draft, profile, projects);
  }

  import(): void {
    this.saving.set(true);
    this.error.set(null);
    this.store
      .importCv(importRequest(this.review))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.modal.close(selectedCount(this.review)),
        error: (e: ApiError) => this.error.set(e.message),
      });
  }
}
