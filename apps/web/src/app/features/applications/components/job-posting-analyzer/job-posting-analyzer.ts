import { Component, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { JOB_POSTING_LIMITS, JobPostingDraft } from '@devstart/shared-types';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/http/error.interceptor';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { JobPostingApi } from '../../data/job-posting-api';
import { describeDraft } from '../application-form-modal/application-form.util';

/**
 * "Analisar o anúncio": o utilizador cola o texto e a IA lê-o. Diz antes para
 * onde vai o texto, e depois o que encontrou. Quem decide o que entra no
 * formulário é o formulário (evento `analyzed`).
 */
@Component({
  selector: 'ds-job-posting-analyzer',
  template: `
    <details class="border rounded-3 p-3" [open]="open()">
      <summary class="fw-medium">
        <i class="bi bi-stars me-1 text-primary"></i>Analisar o anúncio
        <span class="small text-body-secondary fw-normal"
          >(opcional: a IA preenche os campos abaixo)</span
        >
      </summary>
      <textarea
        class="form-control mt-2"
        rows="6"
        aria-label="Texto do anúncio"
        placeholder="Cola aqui o anúncio completo: empresa, título, requisitos, anos de experiência, tecnologias…"
        [value]="text()"
        (input)="text.set($any($event.target).value)"
        [maxLength]="limits.maxText"
      ></textarea>
      @if (reader(); as r) {
        <p class="small text-body-secondary mt-1 mb-0">
          @if (r.externalProvider) {
            <i class="bi bi-cloud-arrow-up me-1"></i>O texto é enviado para a
            <strong>{{ r.externalProvider }}</strong> ({{ r.label }}) para ser
            lido. Não fica guardado.
          } @else {
            <i class="bi bi-shield-lock me-1"></i>Lido por uma IA no teu
            computador ({{ r.label }}).
          }
        </p>
      }
      <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
        <button
          type="button"
          class="btn btn-sm btn-primary"
          [disabled]="analyzing()"
          (click)="analyze()"
        >
          @if (analyzing()) {
            <span
              class="spinner-border spinner-border-sm me-1"
              aria-hidden="true"
            ></span>
            A analisar…
          } @else {
            <i class="bi bi-stars me-1"></i>Analisar
          }
        </button>
        @if (result(); as a) {
          <span
            class="small"
            [class.text-success]="a.ok"
            [class.text-warning-emphasis]="!a.ok"
            role="status"
          >
            <i
              class="bi me-1"
              [class.bi-check-circle]="a.ok"
              [class.bi-exclamation-triangle]="!a.ok"
            ></i
            >{{ a.text }}
          </span>
        }
      </div>
      @if (otherSkills().length) {
        <p class="small text-body-secondary mt-2 mb-0">
          Também pede (fora do catálogo): {{ otherSkills().join(', ') }}.
        </p>
      }
    </details>
  `,
})
export class JobPostingAnalyzer {
  private readonly api = inject(JobPostingApi);
  private readonly profile = inject(ProfileStore);

  /** Aberto por omissão numa candidatura nova; fechado ao editar. */
  readonly open = input(true);
  readonly analyzed = output<JobPostingDraft>();

  protected readonly limits = JOB_POSTING_LIMITS;
  protected readonly text = signal('');
  protected readonly analyzing = signal(false);
  /** Resultado da última análise: ok = a IA leu; senão, aviso. */
  protected readonly result = signal<{ ok: boolean; text: string } | null>(
    null,
  );
  protected readonly otherSkills = signal<string[]>([]);
  /** Que IA lê o anúncio (a mesma que lê os CVs), para o aviso. */
  protected readonly reader = toSignal(this.profile.cvReader$, {
    initialValue: null,
  });

  analyze(): void {
    const text = this.text().trim();
    if (text.length < JOB_POSTING_LIMITS.minText) {
      this.result.set({
        ok: false,
        text: 'Cola primeiro o texto completo do anúncio.',
      });
      return;
    }
    this.analyzing.set(true);
    this.result.set(null);
    this.api
      .analyze(text)
      .pipe(finalize(() => this.analyzing.set(false)))
      .subscribe({
        next: (draft) => {
          this.analyzed.emit(draft);
          this.otherSkills.set(draft.otherSkills);
          this.result.set(describeDraft(draft));
        },
        error: (e: ApiError) => this.result.set({ ok: false, text: e.message }),
      });
  }
}
