import { Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { DemoLauncher } from '../../../../core/demo/demo-launcher';
import { ApiError } from '../../../../core/http/error.interceptor';

/** Botão "Experimentar sem registo": cria uma conta de demonstração e entra. */
@Component({
  selector: 'ds-demo-button',
  template: `
    <button
      type="button"
      [class]="'btn ' + btnClass()"
      [disabled]="starting()"
      (click)="start()"
    >
      @if (starting()) {
        <span
          class="spinner-border spinner-border-sm me-2"
          aria-hidden="true"
        ></span>
        A preparar a demonstração…
      } @else {
        <i class="bi bi-play-circle me-2"></i>Experimentar sem registo
      }
    </button>
    @if (error(); as e) {
      <div class="small text-danger mt-2" role="alert">{{ e }}</div>
    }
  `,
})
export class DemoButton {
  private readonly launcher = inject(DemoLauncher);
  private readonly router = inject(Router);

  readonly btnClass = input('btn-outline-primary');

  protected readonly starting = signal(false);
  protected readonly error = signal<string | null>(null);

  start(): void {
    this.starting.set(true);
    this.error.set(null);
    this.launcher
      .start()
      .pipe(finalize(() => this.starting.set(false)))
      .subscribe({
        // O diagnóstico é o que mostra mais depressa o que a aplicação faz.
        next: () => this.router.navigateByUrl('/skill-gap'),
        error: (e: ApiError) => this.error.set(e.message),
      });
  }
}
