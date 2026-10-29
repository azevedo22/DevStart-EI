import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';

/** Aviso fixo no topo enquanto se usa uma conta de demonstração. */
@Component({
  selector: 'ds-demo-banner',
  template: `
    @if (auth.isDemo()) {
      <div class="bg-warning-subtle border-bottom border-warning-subtle small">
        <div
          class="container d-flex flex-wrap align-items-center gap-2 py-2"
          role="status"
        >
          <i class="bi bi-info-circle text-warning-emphasis"></i>
          <span class="me-auto">
            <strong>Conta de demonstração</strong> com dados fictícios. Podes
            mexer à vontade: é apagada automaticamente {{ timeLeft() }}.
          </span>
          <span class="d-flex gap-3 flex-shrink-0">
            <button
              type="button"
              class="btn btn-sm btn-link text-warning-emphasis p-0"
              [disabled]="ending()"
              (click)="end('/register')"
            >
              Criar uma conta a sério
            </button>
            <button
              type="button"
              class="btn btn-sm btn-link text-warning-emphasis p-0"
              [disabled]="ending()"
              (click)="end('/')"
            >
              Terminar demonstração
            </button>
          </span>
        </div>
      </div>
    }
  `,
})
export class DemoBanner {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly ending = signal(false);

  protected readonly timeLeft = computed(() => {
    const expires = this.auth.user()?.demoExpiresAt;
    if (!expires) return '';
    const hours = Math.round(
      (new Date(expires).getTime() - Date.now()) / 3_600_000,
    );
    return hours <= 1 ? 'dentro de uma hora' : `dentro de ${hours} horas`;
  });

  /** Apaga já a conta de demonstração (sem password) em vez de esperar pela expiração. */
  end(goTo: '/' | '/register'): void {
    this.ending.set(true);
    this.auth
      .deleteAccount()
      .pipe(finalize(() => this.ending.set(false)))
      .subscribe({
        next: () =>
          this.router.navigateByUrl(goTo, { state: { demoEnded: true } }),
        // Se falhar, a conta expira sozinha; a sessão local termina na mesma.
        error: () => {
          this.auth.clearSession();
          this.router.navigateByUrl(goTo);
        },
      });
  }
}
