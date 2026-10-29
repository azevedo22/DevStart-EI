import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { safeReturnUrl } from '../../../../core/auth/auth.guards';
import { DemoButton } from '../../../demo/components/demo-button/demo-button';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApiError } from '../../../../core/http/error.interceptor';
import { FieldError } from '../../../../shared/forms/field-error';

@Component({
  selector: 'ds-login-page',
  imports: [ReactiveFormsModule, RouterLink, FieldError, DemoButton],
  template: `
    <div class="container py-5">
      <div class="row justify-content-center">
        <div class="col-sm-9 col-md-6 col-lg-5 col-xl-4">
          <h1 class="h3 mb-1">Entrar</h1>
          <p class="text-body-secondary mb-4">Continua onde ficaste.</p>

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
                  autocomplete="current-password"
                />
                <ds-field-error [control]="form.controls.password" />
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
                Entrar
              </button>
            </div>
          </form>

          <p class="text-center mt-3 mb-0 small">
            Ainda não tens conta?
            <a
              routerLink="/register"
              [queryParams]="returnUrl() ? { returnUrl: returnUrl() } : {}"
              >Cria uma</a
            >
          </p>
          <div class="text-center border-top mt-3 pt-3">
            <p class="small text-body-secondary mb-2">
              Só queres ver como funciona?
            </p>
            <ds-demo-button btnClass="btn-outline-secondary btn-sm" />
          </div>
        </div>
      </div>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Preenchido pelo router a partir de ?returnUrl= (withComponentInputBinding). */
  readonly returnUrl = input<string>();

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    this.auth
      .login(this.form.getRawValue())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
        error: (e: ApiError) => this.error.set(e.message),
      });
  }
}
