import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  INTERVIEW_TYPE_LABELS,
  REPLY_KINDS,
  REPLY_KIND_LABELS,
  REPLY_LIMITS,
  ReplyDraft,
  ReplyKind,
  STATUS_LABELS,
} from '@devstart/shared-types';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { finalize, firstValueFrom } from 'rxjs';
import { ApiError } from '../../../../core/http/error.interceptor';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { ApplicationsStore } from '../../data/applications-store';
import { ReplyApi } from '../../data/reply-api';
import {
  replyCandidates,
  replyPlan,
  scheduledIso,
  splitScheduled,
  toCandidate,
} from './reply-modal.util';

/** Resultado do modal: a candidatura que mudou. */
export interface ReplyApplied {
  applicationId: string;
}

/**
 * "Recebi uma resposta": a pessoa cola o email da empresa, a IA diz o que é
 * (rejeição, entrevista, teste, proposta), de que candidatura e para quando.
 * Tudo fica editável e nada muda no quadro sem carregar em "Aplicar".
 */
@Component({
  selector: 'ds-reply-modal',
  imports: [FormsModule],
  template: `
    <div class="modal-header">
      <h2 class="modal-title h5">
        <i class="bi bi-envelope-open me-2 text-primary"></i>Recebi uma resposta
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
        <div class="alert alert-danger py-2 mb-0" role="alert">{{ e }}</div>
      }

      @if (!candidates().length) {
        <p class="text-body-secondary mb-0">
          Ainda não tens candidaturas enviadas à espera de resposta.
        </p>
      } @else {
        <div>
          <label for="replyText" class="form-label"
            >Cola o email da empresa</label
          >
          <textarea
            id="replyText"
            class="form-control"
            rows="7"
            [ngModel]="text()"
            (ngModelChange)="text.set($event)"
            [maxLength]="limits.maxText"
            placeholder="Olá, obrigado pela tua candidatura… Gostaríamos de te convidar para uma entrevista na próxima terça às 10h."
          ></textarea>
          @if (reader(); as r) {
            <p class="small text-body-secondary mt-1 mb-0">
              @if (r.externalProvider) {
                <i class="bi bi-cloud-arrow-up me-1"></i>O texto é enviado para
                a <strong>{{ r.externalProvider }}</strong> ({{ r.label }}) para
                ser lido, com a empresa e a vaga das tuas candidaturas. Não fica
                guardado.
              } @else {
                <i class="bi bi-shield-lock me-1"></i>Lido por uma IA no teu
                computador ({{ r.label }}). Não fica guardado.
              }
            </p>
          }
          <button
            type="button"
            class="btn btn-sm btn-primary mt-2"
            [disabled]="analyzing()"
            (click)="analyze()"
          >
            @if (analyzing()) {
              <span
                class="spinner-border spinner-border-sm me-1"
                aria-hidden="true"
              ></span>
              A ler…
            } @else {
              <i class="bi bi-stars me-1"></i>Analisar
            }
          </button>
        </div>

        @if (draft(); as d) {
          <section class="border rounded-3 p-3 vstack gap-3" aria-live="polite">
            @if (d.summary) {
              <p class="mb-0 fw-medium">{{ d.summary }}</p>
            }
            @for (w of d.warnings; track w) {
              <p class="small text-warning-emphasis mb-0">
                <i class="bi bi-exclamation-triangle me-1"></i>{{ w }}
              </p>
            }

            <div class="row g-3">
              <div class="col-sm-6">
                <label for="replyKind" class="form-label"
                  >Tipo de resposta</label
                >
                <select
                  id="replyKind"
                  class="form-select"
                  [ngModel]="kind()"
                  (ngModelChange)="setKind($event)"
                >
                  @for (k of kinds; track k) {
                    <option [value]="k">{{ kindLabels[k] }}</option>
                  }
                </select>
              </div>
              <div class="col-sm-6">
                <label for="replyApp" class="form-label">Candidatura</label>
                <select
                  id="replyApp"
                  class="form-select"
                  [ngModel]="applicationId()"
                  (ngModelChange)="setApplication($event)"
                >
                  <option value="">Escolhe…</option>
                  @for (a of candidates(); track a.id) {
                    <option [value]="a.id">
                      {{ a.companyName }} · {{ a.jobTitle }}
                    </option>
                  }
                </select>
              </div>
            </div>

            @if (kind() === 'INTERVIEW') {
              <div>
                <span class="form-label d-block">Entrevista</span>
                <div class="btn-group btn-group-sm" role="group">
                  <input
                    type="radio"
                    class="btn-check"
                    name="ivType"
                    id="ivHr"
                    [checked]="interviewType() !== 'TECHNICAL'"
                    (change)="setInterviewType('HR')"
                  />
                  <label class="btn btn-outline-secondary" for="ivHr"
                    >RH / primeira conversa</label
                  >
                  <input
                    type="radio"
                    class="btn-check"
                    name="ivType"
                    id="ivTech"
                    [checked]="interviewType() === 'TECHNICAL'"
                    (change)="setInterviewType('TECHNICAL')"
                  />
                  <label class="btn btn-outline-secondary" for="ivTech"
                    >Técnica</label
                  >
                </div>
              </div>
            }

            @if (plan().interviewType) {
              <div class="row g-3">
                <div class="col-7">
                  <label for="replyDate" class="form-label">Data</label>
                  <input
                    id="replyDate"
                    type="date"
                    class="form-control"
                    [ngModel]="date()"
                    (ngModelChange)="date.set($event)"
                  />
                </div>
                <div class="col-5">
                  <label for="replyTime" class="form-label">Hora</label>
                  <input
                    id="replyTime"
                    type="time"
                    class="form-control"
                    [ngModel]="time()"
                    (ngModelChange)="time.set($event)"
                  />
                </div>
                @if (date() && !time()) {
                  <p class="small text-body-secondary mb-0">
                    O email não diz a hora. Se não a escolheres, fica às 09:00.
                  </p>
                }
              </div>
            }

            <div class="vstack gap-1">
              <span class="form-label mb-1">Ao aplicar</span>
              @if (plan().moveTo; as to) {
                <div class="form-check">
                  <input
                    id="doMove"
                    class="form-check-input"
                    type="checkbox"
                    [ngModel]="doMove()"
                    (ngModelChange)="doMove.set($event)"
                  />
                  <label for="doMove" class="form-check-label">
                    Mover o cartão para <strong>{{ statusLabels[to] }}</strong>
                    @if (current(); as c) {
                      <span class="text-body-secondary ms-1"
                        >(está em {{ statusLabels[c.status] }})</span
                      >
                    }
                  </label>
                </div>
              } @else if (current(); as c) {
                @if (kind() !== 'OTHER') {
                  <p class="small text-body-secondary mb-0">
                    O cartão já está em {{ statusLabels[c.status] }}.
                  </p>
                }
              }
              @if (plan().interviewType; as t) {
                <div class="form-check">
                  <input
                    id="doInterview"
                    class="form-check-input"
                    type="checkbox"
                    [ngModel]="doInterview()"
                    (ngModelChange)="doInterview.set($event)"
                  />
                  <label for="doInterview" class="form-check-label">
                    Registar: <strong>{{ interviewLabels[t] }}</strong>
                  </label>
                </div>
              }
              @if (kind() === 'OTHER') {
                <p class="small text-body-secondary mb-0">
                  Não é uma mudança de fase: nada a aplicar no quadro.
                </p>
              }
            </div>
          </section>
        }
      }
    </div>

    <div class="modal-footer">
      <button type="button" class="btn btn-light" (click)="modal.dismiss()">
        Cancelar
      </button>
      @if (draft()) {
        <button
          type="button"
          class="btn btn-primary"
          [disabled]="!canApply() || applying()"
          (click)="apply()"
        >
          Aplicar
        </button>
      }
    </div>
  `,
})
export class ReplyModal {
  protected readonly modal = inject(NgbActiveModal);
  private readonly api = inject(ReplyApi);
  private readonly store = inject(ApplicationsStore);
  private readonly profile = inject(ProfileStore);

  protected readonly limits = REPLY_LIMITS;
  protected readonly kinds = REPLY_KINDS;
  protected readonly kindLabels = REPLY_KIND_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly interviewLabels = INTERVIEW_TYPE_LABELS;

  protected readonly reader = toSignal(this.profile.cvReader$, {
    initialValue: null,
  });
  protected readonly candidates = computed(() =>
    replyCandidates(this.store.board()),
  );

  protected readonly text = signal('');
  protected readonly analyzing = signal(false);
  protected readonly applying = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly draft = signal<ReplyDraft | null>(null);

  protected readonly kind = signal<ReplyKind>('OTHER');
  protected readonly applicationId = signal('');
  protected readonly interviewType = signal<'HR' | 'TECHNICAL'>('HR');
  protected readonly date = signal('');
  protected readonly time = signal('');
  protected readonly doMove = signal(true);
  protected readonly doInterview = signal(true);
  /** Do detalhe de uma candidatura: vem já escolhida. */
  private preselected: string | null = null;

  protected readonly current = computed(
    () => this.candidates().find((a) => a.id === this.applicationId()) ?? null,
  );
  protected readonly plan = computed(() =>
    replyPlan(
      this.kind(),
      this.interviewType(),
      this.current()?.status ?? null,
    ),
  );
  protected readonly canApply = computed(() => {
    if (!this.current()) return false;
    const p = this.plan();
    return (
      (!!p.moveTo && this.doMove()) || (!!p.interviewType && this.doInterview())
    );
  });

  init(applicationId: string | null): void {
    this.preselected = applicationId;
    if (applicationId) this.applicationId.set(applicationId);
  }

  analyze(): void {
    const text = this.text().trim();
    if (text.length < REPLY_LIMITS.minText) {
      this.error.set('Cola primeiro o texto do email.');
      return;
    }
    // Do detalhe, só essa candidatura: a IA não tem de adivinhar.
    const pool = this.preselected
      ? this.candidates().filter((a) => a.id === this.preselected)
      : this.candidates();
    this.analyzing.set(true);
    this.error.set(null);
    this.api
      .analyze({
        text,
        candidates: pool.map(toCandidate),
        today: this.store.today(),
      })
      .pipe(finalize(() => this.analyzing.set(false)))
      .subscribe({
        next: (d) => this.show(d),
        error: (e: ApiError) => this.error.set(e.message),
      });
  }

  protected setKind(kind: ReplyKind): void {
    this.kind.set(kind);
    this.refreshDefaults();
  }

  protected setApplication(id: string): void {
    this.applicationId.set(id);
    this.refreshDefaults();
  }

  protected setInterviewType(t: 'HR' | 'TECHNICAL'): void {
    this.interviewType.set(t);
    this.refreshDefaults();
  }

  async apply(): Promise<void> {
    const app = this.current();
    if (!app) return;
    const p = this.plan();
    this.applying.set(true);
    this.error.set(null);
    try {
      if (p.moveTo && this.doMove()) await this.store.move(app.id, p.moveTo, 0);
      if (p.interviewType && this.doInterview()) {
        await firstValueFrom(
          this.store.saveInterview(app.id, {
            type: p.interviewType,
            scheduledAt: scheduledIso(this.date(), this.time()),
            completed: false,
            outcome: 'PENDING',
            questionsAsked: [],
          }),
        );
      }
      this.modal.close({ applicationId: app.id } satisfies ReplyApplied);
    } catch (e) {
      this.error.set((e as ApiError).message);
    } finally {
      this.applying.set(false);
    }
  }

  private show(d: ReplyDraft): void {
    this.draft.set(d);
    this.kind.set(d.kind);
    if (d.applicationId) this.applicationId.set(d.applicationId);
    this.interviewType.set(
      d.interviewType === 'TECHNICAL' ? 'TECHNICAL' : 'HR',
    );
    const { date, time } = splitScheduled(d.scheduledAt);
    this.date.set(date);
    this.time.set(time);
    this.refreshDefaults();
  }

  /** Mover é o padrão, menos quando faria o cartão recuar. */
  private refreshDefaults(): void {
    this.doMove.set(this.plan().moveSuggested);
    this.doInterview.set(true);
  }
}
