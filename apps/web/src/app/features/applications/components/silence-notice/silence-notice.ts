import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  FollowUpLanguage,
  SILENCE,
  Silence,
  followUpDraft,
} from '@devstart/shared-types';
import { AuthService } from '../../../../core/auth/auth.service';

/**
 * O silêncio de uma empresa, no detalhe da candidatura. Aos 14 dias propõe um
 * follow-up (um rascunho curto, em português ou inglês, pronto a copiar ou a
 * abrir no email); aos 30, propõe arquivar em "Sem resposta". A pessoa decide.
 */
@Component({
  selector: 'ds-silence-notice',
  template: `
    @let s = silence();
    @let d = draft();
    <section
      class="silence rounded-3 p-3"
      [class.give-up]="s.stage === 'GIVE_UP'"
      aria-labelledby="silence-title"
    >
      <h3 id="silence-title" class="h6 mb-1">
        <i class="bi bi-hourglass-split me-1"></i>Sem resposta há
        {{ s.days }} dias
      </h3>
      <p class="small text-body-secondary mb-2">
        @if (s.stage === 'GIVE_UP') {
          Ao fim de {{ giveUpAfter }} dias já poucas empresas respondem. Podes
          arquivar em "Sem resposta": sai do caminho, sem contar como rejeição,
          e se responderem volta ao sítio.
        } @else {
          Quem responde costuma fazê-lo na primeira semana ou duas. Um follow-up
          curto e educado mostra interesse e pode desbloquear o processo.
        }
      </p>

      <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
        <div class="btn-group btn-group-sm" role="group" aria-label="Língua">
          @for (l of languages; track l.id) {
            <button
              type="button"
              class="btn"
              [class.btn-secondary]="lang() === l.id"
              [class.btn-outline-secondary]="lang() !== l.id"
              [attr.aria-pressed]="lang() === l.id"
              (click)="lang.set(l.id)"
            >
              {{ l.label }}
            </button>
          }
        </div>
        <span class="small text-body-secondary">Rascunho de follow-up</span>
      </div>
      <div class="draft small border rounded-2 bg-body p-2 mb-2">
        <div class="fw-semibold mb-1">{{ d.subject }}</div>
        <div class="body">{{ d.body }}</div>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-sm btn-outline-primary"
          (click)="copy()"
        >
          <i class="bi bi-clipboard me-1"></i
          >{{ copied() ? 'Copiado!' : 'Copiar' }}
        </button>
        <a class="btn btn-sm btn-outline-primary" [href]="mailto()">
          <i class="bi bi-envelope me-1"></i>Abrir no email
        </a>
        @if (s.stage === 'GIVE_UP') {
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary ms-auto"
            [disabled]="busy()"
            (click)="giveUp.emit()"
          >
            <i class="bi bi-archive me-1"></i>Marcar como sem resposta
          </button>
        }
      </div>
    </section>
  `,
  styles: `
    .silence {
      background: var(--bs-warning-bg-subtle);
      border: 1px solid var(--bs-warning-border-subtle);
    }
    .silence.give-up {
      background: var(--bs-secondary-bg-subtle);
      border-color: var(--bs-secondary-border-subtle);
    }
    .draft .body {
      white-space: pre-line;
    }
  `,
})
export class SilenceNotice {
  private readonly auth = inject(AuthService);

  readonly application = input.required<{
    companyName: string;
    jobTitle: string;
    appliedAt: string;
  }>();
  readonly silence = input.required<Silence>();
  readonly busy = input(false);
  readonly giveUp = output<void>();

  protected readonly giveUpAfter = SILENCE.giveUpAfterDays;
  protected readonly languages: { id: FollowUpLanguage; label: string }[] = [
    { id: 'pt', label: 'PT' },
    { id: 'en', label: 'EN' },
  ];
  protected readonly lang = signal<FollowUpLanguage>('pt');
  protected readonly copied = signal(false);

  protected readonly draft = computed(() =>
    followUpDraft(this.application(), this.lang(), this.auth.user()?.fullName),
  );

  protected readonly mailto = computed(() => {
    const d = this.draft();
    return `mailto:?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
  });

  protected async copy(): Promise<void> {
    const d = this.draft();
    try {
      await navigator.clipboard.writeText(`${d.subject}\n\n${d.body}`);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Sem acesso à área de transferência: o texto continua visível para copiar à mão.
    }
  }
}
