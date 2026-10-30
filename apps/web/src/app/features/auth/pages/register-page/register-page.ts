import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PASSWORD_RULES } from '@devstart/shared-types';
import { finalize } from 'rxjs';
import { safeReturnUrl } from '../../../../core/auth/auth.guards';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApiError } from '../../../../core/http/error.interceptor';
import { FieldError } from '../../../../shared/forms/field-error';

@Component({
  selector: 'ds-register-page',
  imports: [ReactiveFormsModule, RouterLink, FieldError],
  template: `
    <div class="container py-5">
      <div class="row justify-content-center">
        <div class="col-sm-9 col-md-6 col-lg-5 col-xl-4">
          <h1 class="h3 mb-1">Criar conta</h1>
          <p class="text-body-secondary mb-4">
            Guarda o teu perfil, os teus projetos e as tuas candidaturas.
          </p>

          <form
            [formGroup]="form"
            (ngSubmit)="submit()"
            class="card border-0 shadow-sm"
            novalidate
          >
            <div class="card-body vstack gap-3 p-4">
              @if (error(); as e) {
                <div class="alert alert-danger py-2 mb-0" role="alert">
                  {{ e }}
                </div>
              }

              <div>
                <label for="fullName" class="form-label">Nome</label>
                <input
                  id="fullName"
                  class="form-control"
                  formControlName="fullName"
                  autocomplete="name"
                />
                <ds-field-error [control]="form.controls.fullName" />
              </div>

              <div>
                <label for="email" class="form-label">Email</label>
                <input
                  id="email"
                  type="email"
                  class="form-control"
                  formControlName="email"
                  autocomplete="email"
                />
                <ds-field-error [control]="form.controls.email" />
              </div>

              <div>
                <label for="password" class="form-label">Password</label>
                <input
                  id="password"
                  type="password"
                  class="form-control"
                  formControlName="password"
                  autocomplete="new-password"
                  aria-describedby="passwordHelp"
                />
                <div id="passwordHelp" class="form-text">
                  {{ passwordHint }}
                </div>
                <ds-field-error
                  [control]="form.controls.password"
                  [messages]="{
                    pattern: passwordError,
                    minlength: passwordError,
                  }"
                />
              </div>

              <button
                type="submit"
                class="btn btn-primary w-100"
                [disabled]="submitting()"
              >
                @if (submitting()) {
                  <span
                    class="spinner-border spinner-border-sm me-2"
                    aria-hidden="true"
                  ></span>
                }
                Criar conta
              </button>
            </div>
          </form>

          <p class="text-center mt-3 mb-0 small">
            Já tens conta?
            <a
              routerLink="/login"
              [queryParams]="returnUrl() ? { returnUrl: returnUrl() } : {}"
              >Entra</a
            >
          </p>
        </div>
      </div>
    </div>
  `,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly returnUrl = input<string>();

  protected readonly passwordHint = PASSWORD_RULES.message;
  protected readonly passwordError =
    'A password ainda não cumpre a regra acima.';
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  /** As mesmas regras que o backend valida, vindas de @devstart/shared-types. */
  protected readonly form = inject(FormBuilder).nonNullable.group({
    fullName: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    ],
    email: [
      '',
      [Validators.required, Validators.email, Validators.maxLength(254)],
    ],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(PASSWORD_RULES.minLength),
        Validators.maxLength(PASSWORD_RULES.maxLength),
        Validators.pattern(PASSWORD_RULES.pattern),
      ],
    ],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    this.auth
      .register(this.form.getRawValue())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        // Sem destino pedido, uma conta nova começa pelo perfil (importar o CV).
        next: () =>
          this.returnUrl()
            ? this.router.navigateByUrl(safeReturnUrl(this.returnUrl()))
            : this.router.navigateByUrl('/profile', {
                state: { welcome: true },
              }),
        error: (e: ApiError) => {
          if (e.status === 409) {
            this.form.controls.email.setErrors({ server: e.message });
          } else {
            this.error.set(e.message);
          }
        },
      });
  }
}
