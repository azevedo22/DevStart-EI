import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApiError } from '../../../../core/http/error.interceptor';

/**
 * A minha conta: dados de acesso e eliminação da conta (direito ao apagamento).
 * Apagar pede a password outra vez e explica exatamente o que desaparece.
 */
@Component({
  selector: 'ds-account-page',
  imports: [DatePipe, FormsModule],
  template: `
    <div class="container py-4" style="max-width: 46rem">
      <h1 class="h3 mb-4">A minha conta</h1>

      <section class="card border-0 shadow-sm mb-4">
        <div class="card-body p-4">
          <h2 class="h6 text-body-secondary text-uppercase small mb-3">
            Dados de acesso
          </h2>
          <dl class="row mb-0">
            <dt class="col-sm-4 fw-normal text-body-secondary">Nome</dt>
            <dd class="col-sm-8">{{ auth.user()?.fullName }}</dd>
            <dt class="col-sm-4 fw-normal text-body-secondary">Email</dt>
            <dd class="col-sm-8">{{ auth.user()?.email }}</dd>
            <dt class="col-sm-4 fw-normal text-body-secondary">Conta criada</dt>
            <dd class="col-sm-8 mb-0">
              {{ auth.user()?.createdAt | date: 'longDate' }}
            </dd>
          </dl>
        </div>
      </section>

      @if (auth.isDemo()) {
        <section class="card border-warning-subtle shadow-sm">
          <div class="card-body p-4">
            <h2 class="h5">Conta de demonstração</h2>
            <p class="text-body-secondary">
              Esta conta e os dados de exemplo são apagados automaticamente a
              {{ auth.user()?.demoExpiresAt | date: 'short' }}. Podes terminar
              já, sem password.
            </p>
            <button
              type="button"
              class="btn btn-outline-danger"
              [disabled]="deleting()"
              (click)="endDemo()"
            >
              Terminar demonstração
            </button>
          </div>
        </section>
      } @else {
        <section class="card border-danger-subtle shadow-sm">
          <div class="card-body p-4">
            <h2 class="h5 text-danger">Apagar conta</h2>
            <p class="mb-2">
              Apaga a conta e todos os teus dados, em todos os serviços:
            </p>
            <ul class="small text-body-secondary">
              <li>dados de acesso e sessões abertas noutros dispositivos;</li>
              <li>perfil, competências declaradas e projetos;</li>
              <li>candidaturas, entrevistas e o histórico do quadro.</li>
            </ul>
            <p class="small text-body-secondary">Não é possível desfazer.</p>

            @if (!confirming()) {
              <button
                type="button"
                class="btn btn-outline-danger"
                (click)="confirming.set(true)"
              >
                Quero apagar a minha conta
              </button>
            } @else {
              <form
                class="vstack gap-3 border-top pt-3"
                (ngSubmit)="deleteAccount()"
                novalidate
              >
                @if (error(); as e) {
                  <div class="alert alert-danger py-2 mb-0" role="alert">
                    {{ e }}
                  </div>
                }
                <div>
                  <label for="confirmPassword" class="form-label"
                    >Para confirmar, escreve a tua password</label
                  >
                  <input
                    id="confirmPassword"
                    name="password"
                    type="password"
                    class="form-control"
                    autocomplete="current-password"
                    [(ngModel)]="password"
                    required
                  />
                </div>
                <div class="d-flex gap-2">
                  <button
                    type="button"
                    class="btn btn-light"
                    (click)="cancel()"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    class="btn btn-danger"
                    [disabled]="!password || deleting()"
                  >
                    @if (deleting()) {
                      <span
                        class="spinner-border spinner-border-sm me-2"
                        aria-hidden="true"
                      ></span>
                    }
                    Apagar definitivamente
                  </button>
                </div>
              </form>
            }
          </div>
        </section>
      }
    </div>
  `,
})
export class AccountPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected password = '';
  protected readonly confirming = signal(false);
  protected readonly deleting = signal(false);
  protected readonly error = signal<string | null>(null);

  cancel(): void {
    this.password = '';
    this.error.set(null);
    this.confirming.set(false);
  }

  endDemo(): void {
    this.deleting.set(true);
    this.auth
      .deleteAccount()
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe({
        next: () => this.router.navigate(['/'], { state: { demoEnded: true } }),
        error: (e: ApiError) => this.error.set(e.message),
      });
  }

  deleteAccount(): void {
    if (!this.password) return;
    this.deleting.set(true);
    this.error.set(null);
    this.auth
      .deleteAccount(this.password)
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe({
        next: () =>
          this.router.navigate(['/'], { state: { accountDeleted: true } }),
        error: (e: ApiError) => {
          this.password = '';
          this.error.set(e.message);
        },
      });
  }
}
