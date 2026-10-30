import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  BACKGROUND_LIMITS,
  EXPERIENCE_KINDS,
  EXPERIENCE_KIND_LABELS,
  Experience,
  ExperienceKind,
} from '@devstart/shared-types';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/http/error.interceptor';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { FieldError } from '../../../../shared/forms/field-error';

@Component({
  selector: 'ds-experience-form-modal',
  imports: [ReactiveFormsModule, FieldError],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div class="modal-header">
        <h2 class="modal-title h5">
          {{ experience ? 'Editar experiência' : 'Nova experiência' }}
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
          <div class="col-sm-7">
            <label class="form-label" for="role">Função</label>
            <input
              id="role"
              class="form-control"
              formControlName="role"
              placeholder="Ex.: Estagiário de desenvolvimento"
            />
            <ds-field-error [control]="form.controls.role" />
          </div>
          <div class="col-sm-5">
            <label class="form-label" for="kind">Tipo</label>
            <select id="kind" class="form-select" formControlName="kind">
              @for (k of kinds; track k) {
                <option [value]="k">{{ kindLabels[k] }}</option>
              }
            </select>
          </div>
        </div>
        <div>
          <label class="form-label" for="organization">Organização</label>
          <input
            id="organization"
            class="form-control"
            formControlName="organization"
          />
          <ds-field-error [control]="form.controls.organization" />
        </div>
        <div class="row g-3">
          <div class="col-6">
            <label class="form-label" for="startDate">Início</label>
            <input
              id="startDate"
              type="month"
              class="form-control"
              formControlName="startDate"
            />
          </div>
          <div class="col-6">
            <label class="form-label" for="endDate">Fim</label>
            <input
              id="endDate"
              type="month"
              class="form-control"
              formControlName="endDate"
            />
            <div class="form-text">Vazio se ainda estás lá.</div>
          </div>
        </div>
        <div>
          <label class="form-label" for="description"
            >O que fizeste
            <span class="text-body-secondary">(opcional)</span></label
          >
          <textarea
            id="description"
            class="form-control"
            rows="3"
            formControlName="description"
          ></textarea>
          <ds-field-error [control]="form.controls.description" />
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
export class ExperienceFormModal {
  protected readonly modal = inject(NgbActiveModal);
  private readonly store = inject(ProfileStore);
  private readonly fb = inject(FormBuilder).nonNullable;

  experience: Experience | null = null;
  protected readonly kinds = EXPERIENCE_KINDS;
  protected readonly kindLabels = EXPERIENCE_KIND_LABELS;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.group({
    role: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(BACKGROUND_LIMITS.role),
      ],
    ],
    kind: ['JOB' as ExperienceKind],
    organization: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(BACKGROUND_LIMITS.organization),
      ],
    ],
    // <input type="month"> usa exatamente o formato AAAA-MM da API.
    startDate: [''],
    endDate: [''],
    description: [
      '',
      Validators.maxLength(BACKGROUND_LIMITS.experienceDescription),
    ],
  });

  init(experience: Experience | null): void {
    this.experience = experience;
    if (experience) {
      this.form.reset({
        role: experience.role,
        kind: experience.kind,
        organization: experience.organization,
        startDate: experience.startDate ?? '',
        endDate: experience.endDate ?? '',
        description: experience.description ?? '',
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
      .saveExperience(
        {
          ...v,
          startDate: v.startDate || null,
          endDate: v.endDate || null,
          description: v.description || null,
        },
        this.experience?.id,
      )
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.modal.close(),
        error: (e: ApiError) => this.error.set(e.message),
      });
  }
}
