import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PROFILE_LIMITS } from '@devstart/shared-types';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApiError } from '../../../../core/http/error.interceptor';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { FieldError } from '../../../../shared/forms/field-error';

/** Cabeçalho do perfil: nome, título profissional, universidade e apresentação. */
@Component({
  selector: 'ds-profile-info',
  imports: [ReactiveFormsModule, FieldError],
  template: `
    <section class="card border-0 shadow-sm">
      <div class="card-body p-4">
        @if (!editing()) {
          <div class="d-flex justify-content-between align-items-start gap-3">
            <div>
              <h1 class="h3 mb-1">{{ auth.user()?.fullName }}</h1>
              <p
                class="mb-1"
                [class.text-body-secondary]="!profile()?.headline"
              >
                {{ profile()?.headline || 'Ainda sem título profissional' }}
              </p>
              @if (educationLine(); as line) {
                <p class="small text-body-secondary mb-0">
                  <i class="bi bi-mortarboard me-1"></i>{{ line }}
                </p>
              }
            </div>
            <button
              type="button"
              class="btn btn-sm btn-outline-primary flex-shrink-0"
              (click)="startEdit()"
            >
              <i class="bi bi-pencil me-1"></i>Editar
            </button>
          </div>
          @if (profile()?.bio; as bio) {
            <p
              class="mt-3 mb-0 text-body-secondary"
              style="white-space: pre-line"
            >
              {{ bio }}
            </p>
          }
        } @else {
          <form
            [formGroup]="form"
            (ngSubmit)="save()"
            class="vstack gap-3"
            novalidate
          >
            @if (error(); as e) {
              <div class="alert alert-danger py-2 mb-0">{{ e }}</div>
            }
            <div>
              <label for="headline" class="form-label"
                >Título profissional</label
              >
              <input
                id="headline"
                class="form-control"
                formControlName="headline"
                placeholder="Ex.: Recém-licenciado em Engenharia Informática"
              />
              <ds-field-error [control]="form.controls.headline" />
            </div>
            <div class="row g-3">
              <div class="col-sm-8">
                <label for="university" class="form-label">Instituição</label>
                <input
                  id="university"
                  class="form-control"
                  formControlName="university"
                />
                <ds-field-error [control]="form.controls.university" />
              </div>
              <div class="col-sm-4">
                <label for="graduationYear" class="form-label"
                  >Ano de conclusão</label
                >
                <input
                  id="graduationYear"
                  type="number"
                  class="form-control"
                  formControlName="graduationYear"
                />
                <ds-field-error
                  [control]="form.controls.graduationYear"
                  [messages]="yearMessages"
                />
              </div>
            </div>
            <div>
              <label for="bio" class="form-label">Apresentação</label>
              <textarea
                id="bio"
                class="form-control"
                rows="3"
                formControlName="bio"
              ></textarea>
              <div class="form-text text-end">
                {{ form.controls.bio.value.length }}/{{ limits.bio }}
              </div>
              <ds-field-error [control]="form.controls.bio" />
            </div>
            <div class="d-flex gap-2 justify-content-end">
              <button
                type="button"
                class="btn btn-light"
                (click)="editing.set(false)"
              >
                Cancelar
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="saving()"
              >
                Guardar
              </button>
            </div>
          </form>
        }
      </div>
    </section>
  `,
})
export class ProfileInfo {
  protected readonly auth = inject(AuthService);
  private readonly store = inject(ProfileStore);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly limits = PROFILE_LIMITS;
  protected readonly profile = this.store.profile;
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly maxYear =
    new Date().getFullYear() + PROFILE_LIMITS.maxGraduationYearAhead;
  protected readonly yearMessages = {
    min: 'Ano de conclusão inválido.',
    max: 'Ano de conclusão inválido.',
  };

  protected readonly form = this.fb.group({
    headline: ['', Validators.maxLength(PROFILE_LIMITS.headline)],
    university: ['', Validators.maxLength(PROFILE_LIMITS.university)],
    graduationYear: [
      null as number | null,
      [
        Validators.min(PROFILE_LIMITS.minGraduationYear),
        Validators.max(this.maxYear),
      ],
    ],
    bio: ['', Validators.maxLength(PROFILE_LIMITS.bio)],
  });

  protected readonly educationLine = computed(() => {
    const p = this.profile();
    return (
      [p?.university, p?.graduationYear].filter(Boolean).join(' · ') || null
    );
  });

  startEdit(): void {
    const p = this.profile();
    this.form.reset({
      headline: p?.headline ?? '',
      university: p?.university ?? '',
      graduationYear: p?.graduationYear ?? null,
      bio: p?.bio ?? '',
    });
    this.error.set(null);
    this.editing.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    // Campos vazios vão como "" e o servidor guarda-os como null.
    this.store
      .updateInfo({ ...v, graduationYear: v.graduationYear || null })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.editing.set(false),
        error: (e: ApiError) => this.error.set(e.message),
      });
  }
}
