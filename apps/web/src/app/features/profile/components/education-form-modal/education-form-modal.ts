import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BACKGROUND_LIMITS, Education } from '@devstart/shared-types';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/http/error.interceptor';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { FieldError } from '../../../../shared/forms/field-error';

const MIN_YEAR = 1950;
const MAX_YEAR = new Date().getFullYear() + 8;

@Component({
  selector: 'ds-education-form-modal',
  imports: [ReactiveFormsModule, FieldError],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div class="modal-header">
        <h2 class="modal-title h5">
          {{ education ? 'Editar formação' : 'Nova formação' }}
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
        <div>
          <label class="form-label" for="degree">Grau ou curso</label>
          <input
            id="degree"
            class="form-control"
            formControlName="degree"
            placeholder="Ex.: Licenciatura em Engenharia Informática"
          />
          <ds-field-error [control]="form.controls.degree" />
        </div>
        <div>
          <label class="form-label" for="institution">Instituição</label>
          <input
            id="institution"
            class="form-control"
            formControlName="institution"
          />
          <ds-field-error [control]="form.controls.institution" />
        </div>
        <div>
          <label class="form-label" for="field"
            >Área ou especialização
            <span class="text-body-secondary">(opcional)</span></label
          >
          <input
            id="field"
            class="form-control"
            formControlName="fieldOfStudy"
          />
        </div>
        <div class="row g-3">
          <div class="col-6">
            <label class="form-label" for="startYear">Ano de início</label>
            <input
              id="startYear"
              type="number"
              class="form-control"
              formControlName="startYear"
            />
            <ds-field-error
              [control]="form.controls.startYear"
              [messages]="yearMessages"
            />
          </div>
          <div class="col-6">
            <label class="form-label" for="endYear">Ano de conclusão</label>
            <input
              id="endYear"
              type="number"
              class="form-control"
              formControlName="endYear"
              placeholder="Em curso"
            />
            <ds-field-error
              [control]="form.controls.endYear"
              [messages]="yearMessages"
            />
          </div>
        </div>
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
export class EducationFormModal {
  protected readonly modal = inject(NgbActiveModal);
  private readonly store = inject(ProfileStore);
  private readonly fb = inject(FormBuilder).nonNullable;

  education: Education | null = null;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly yearMessages = {
    min: 'Ano inválido.',
    max: 'Ano inválido.',
  };

  protected readonly form = this.fb.group({
    degree: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(BACKGROUND_LIMITS.degree),
      ],
    ],
    institution: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(BACKGROUND_LIMITS.institution),
      ],
    ],
    fieldOfStudy: ['', Validators.maxLength(BACKGROUND_LIMITS.fieldOfStudy)],
    startYear: [
      null as number | null,
      [Validators.min(MIN_YEAR), Validators.max(MAX_YEAR)],
    ],
    endYear: [
      null as number | null,
      [Validators.min(MIN_YEAR), Validators.max(MAX_YEAR)],
    ],
  });

  init(education: Education | null): void {
    this.education = education;
    if (education) {
      this.form.reset({
        degree: education.degree,
        institution: education.institution,
        fieldOfStudy: education.fieldOfStudy ?? '',
        startYear: education.startYear,
        endYear: education.endYear,
      });
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.store
      .saveEducation(
        {
          ...v,
          fieldOfStudy: v.fieldOfStudy || null,
          startYear: v.startYear || null,
          endYear: v.endYear || null,
        },
        this.education?.id,
      )
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.modal.close(),
        error: (e: ApiError) => this.error.set(e.message),
      });
  }
}
