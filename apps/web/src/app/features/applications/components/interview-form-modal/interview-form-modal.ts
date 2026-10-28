import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  APPLICATION_LIMITS,
  INTERVIEW_TYPES,
  INTERVIEW_TYPE_LABELS,
  Interview,
  InterviewOutcome,
  InterviewType,
  OUTCOME_LABELS,
} from '@devstart/shared-types';
import { NgbActiveModal, NgbRating } from '@ng-bootstrap/ng-bootstrap';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/http/error.interceptor';
import { ApplicationsStore } from '../../data/applications-store';

/** Converte ISO para o formato de <input type="datetime-local"> (hora local). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

/**
 * Registar uma entrevista e, depois de acontecer, o feedback.
 * As perguntas feitas são o que mais ajuda a preparar a próxima.
 */
@Component({
  selector: 'ds-interview-form-modal',
  imports: [ReactiveFormsModule, NgbRating],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div class="modal-header">
        <h2 class="modal-title h5">
          {{ interview ? 'Editar entrevista' : 'Nova entrevista' }}
        </h2>
        <button
          type="button"
          class="btn-close"
          aria-label="Fechar"
          (click)="modal.dismiss()"
        ></button>
      </div>
      <div class="modal-body vstack gap-3">
        @if (error(); as e) {
          <div class="alert alert-danger py-2 mb-0">{{ e }}</div>
        }
        <div class="row g-3">
          <div class="col-sm-6">
            <label for="type" class="form-label">Tipo</label>
            <select id="type" class="form-select" formControlName="type">
              @for (t of types; track t) {
                <option [value]="t">{{ typeLabels[t] }}</option>
              }
            </select>
          </div>
          <div class="col-sm-6">
            <label for="scheduledAt" class="form-label">Data e hora</label>
            <input
              id="scheduledAt"
              type="datetime-local"
              class="form-control"
              formControlName="scheduledAt"
            />
          </div>
        </div>

        <div class="form-check form-switch">
          <input
            id="completed"
            class="form-check-input"
            type="checkbox"
            role="switch"
            formControlName="completed"
          />
          <label for="completed" class="form-check-label">Já aconteceu</label>
        </div>

        @if (value().completed) {
          <div class="row g-3 align-items-end">
            <div class="col-sm-6">
              <span class="form-label d-block" id="ratingLabel"
                >Como correu?</span
              >
              <ngb-rating
                formControlName="rating"
                [max]="5"
                aria-labelledby="ratingLabel"
                class="fs-4 text-warning"
              />
            </div>
            <div class="col-sm-6">
              <label for="outcome" class="form-label">Resultado</label>
              <select
                id="outcome"
                class="form-select"
                formControlName="outcome"
              >
                @for (o of outcomes; track o) {
                  <option [value]="o">{{ outcomeLabels[o] }}</option>
                }
              </select>
            </div>
          </div>

          <div>
            <label for="questions" class="form-label"
              >Perguntas que te fizeram
              <span class="text-body-secondary">(uma por linha)</span></label
            >
            <textarea
              id="questions"
              class="form-control"
              rows="4"
              formControlName="questions"
              placeholder="Qual a diferença entre um Observable e uma Promise?"
            ></textarea>
          </div>
          <div class="row g-3">
            <div class="col-sm-6">
              <label for="strengths" class="form-label">O que correu bem</label>
              <textarea
                id="strengths"
                class="form-control"
                rows="3"
                formControlName="strengths"
              ></textarea>
            </div>
            <div class="col-sm-6">
              <label for="improvements" class="form-label"
                >O que melhorar</label
              >
              <textarea
                id="improvements"
                class="form-control"
                rows="3"
                formControlName="improvements"
              ></textarea>
            </div>
          </div>
        }
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-light" (click)="modal.dismiss()">
          Cancelar
        </button>
        <button type="submit" class="btn btn-primary" [disabled]="saving()">
          Guardar
        </button>
      </div>
    </form>
  `,
})
export class InterviewFormModal {
  protected readonly modal = inject(NgbActiveModal);
  private readonly store = inject(ApplicationsStore);
  private readonly fb = inject(FormBuilder).nonNullable;

  applicationId!: string;
  interview: Interview | null = null;

  protected readonly types = INTERVIEW_TYPES;
  protected readonly typeLabels = INTERVIEW_TYPE_LABELS;
  protected readonly outcomes: InterviewOutcome[] = [
    'PENDING',
    'PASSED',
    'FAILED',
  ];
  protected readonly outcomeLabels = OUTCOME_LABELS;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.group({
    type: ['TECHNICAL' as InterviewType],
    scheduledAt: [''],
    completed: [false],
    rating: [0],
    outcome: ['PENDING' as InterviewOutcome],
    questions: [''],
    strengths: [''],
    improvements: [''],
  });
  protected readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  init(
    applicationId: string,
    interview: Interview | null,
    defaultType?: InterviewType,
  ): void {
    this.applicationId = applicationId;
    this.interview = interview;
    if (interview) {
      this.form.reset({
        type: interview.type,
        scheduledAt: toLocalInput(interview.scheduledAt),
        completed: interview.completed,
        rating: interview.rating ?? 0,
        outcome: interview.outcome,
        questions: interview.questionsAsked.join('\n'),
        strengths: interview.strengths ?? '',
        improvements: interview.improvements ?? '',
      });
    } else if (defaultType) {
      this.form.controls.type.setValue(defaultType);
    }
  }

  save(): void {
    const v = this.form.getRawValue();
    const questions = v.questions
      .split('\n')
      .map((q) => q.trim())
      .filter(Boolean);
    if (questions.length > APPLICATION_LIMITS.questions) {
      this.error.set(`No máximo ${APPLICATION_LIMITS.questions} perguntas.`);
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.store
      .saveInterview(
        this.applicationId,
        {
          type: v.type,
          scheduledAt: v.scheduledAt
            ? new Date(v.scheduledAt).toISOString()
            : null,
          completed: v.completed,
          rating: v.completed && v.rating ? v.rating : null,
          outcome: v.outcome,
          questionsAsked: questions,
          strengths: v.strengths,
          improvements: v.improvements,
        },
        this.interview?.id,
      )
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (saved) => this.modal.close(saved),
        error: (e: ApiError) => this.error.set(e.message),
      });
  }
}
