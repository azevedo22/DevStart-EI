import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { CV_LIMITS } from '@devstart/shared-types';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/http/error.interceptor';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { CvReviewModal } from '../cv-review-modal/cv-review-modal';

/**
 * Importar o CV: o utilizador escolhe o ficheiro, a IA lê-o e abre-se a
 * revisão. Com o perfil vazio aparece em destaque; depois, numa linha discreta.
 */
@Component({
  selector: 'ds-cv-import',
  template: `
    <input
      #fileInput
      type="file"
      class="d-none"
      [accept]="accept"
      (change)="onFile($event)"
    />

    @if (prominent()) {
      <section class="card border-primary-subtle shadow-sm cv-hero">
        <div class="card-body p-4 d-flex flex-wrap align-items-center gap-4">
          <i class="bi bi-file-earmark-person fs-1 text-primary"></i>
          <div style="flex: 1 1 20rem">
            <h2 class="h5 mb-1">Começa pelo teu CV</h2>
            <p class="mb-0 text-body-secondary">
              Carrega o CV (PDF ou Word) e a IA preenche o perfil: formação,
              experiência, línguas, competências e projetos. Revês tudo antes de
              gravar.
            </p>
          </div>
          <ng-container *ngTemplateOutlet="action" />
        </div>
        <div class="px-4 pb-3 mt-n2">
          <ng-container *ngTemplateOutlet="notice" />
        </div>
        <ng-container *ngTemplateOutlet="feedback" />
      </section>
    } @else {
      <div
        class="d-flex flex-wrap align-items-center gap-2 small text-body-secondary"
      >
        <i class="bi bi-file-earmark-person"></i>
        <span class="me-auto">Tens um CV mais recente?</span>
        <ng-container *ngTemplateOutlet="action" />
      </div>
      <div class="mt-1">
        <ng-container *ngTemplateOutlet="notice" />
      </div>
      <ng-container *ngTemplateOutlet="feedback" />
    }

    <!-- Aviso ANTES do envio: o utilizador sabe para onde vai o CV. -->
    <ng-template #notice>
      @if (reader(); as r) {
        <p class="small mb-0 text-body-secondary">
          @if (r.externalProvider) {
            <i class="bi bi-cloud-arrow-up me-1"></i>O CV é enviado para a
            <strong>{{ r.externalProvider }}</strong
            >, um serviço de IA externo, para ser lido ({{ r.label }}). Nada
            entra no teu perfil sem confirmares, e o ficheiro não fica guardado
            no DevStart EI.
          } @else {
            <i class="bi bi-shield-lock me-1"></i>O CV é lido por uma IA no teu
            computador ({{ r.label }}) e não é enviado para fora.
          }
        </p>
      }
    </ng-template>

    <ng-template #action>
      <button
        type="button"
        [class]="
          'btn flex-shrink-0 ' +
          (prominent() ? 'btn-primary' : 'btn-sm btn-outline-primary')
        "
        [disabled]="analyzing()"
        (click)="fileInput.click()"
      >
        @if (analyzing()) {
          <span
            class="spinner-border spinner-border-sm me-2"
            aria-hidden="true"
          ></span>
          A ler o CV… {{ elapsed() }} s
        } @else {
          <i class="bi bi-stars me-1"></i>Importar do CV
        }
      </button>
    </ng-template>

    <ng-template #feedback>
      <div [class]="prominent() ? 'px-4 pb-3' : 'mt-2'">
        @if (analyzing() && elapsed() >= 10) {
          <div class="small text-body-secondary" role="status">
            Com uma IA local, num CV longo, pode demorar um minuto ou mais.
          </div>
        }
        @if (error(); as e) {
          <div class="alert alert-danger py-2 small mb-0" role="alert">
            {{ e }}
          </div>
        }
        @if (done(); as d) {
          <div
            class="alert py-2 small mb-0"
            [class.alert-success]="!withoutAi()"
            [class.alert-warning]="withoutAi()"
            role="status"
          >
            <i
              class="bi me-1"
              [class.bi-check-circle]="!withoutAi()"
              [class.bi-exclamation-triangle]="withoutAi()"
            ></i
            >{{ d }}
          </div>
        }
      </div>
    </ng-template>
  `,
  imports: [NgTemplateOutlet],
  styles: `
    .cv-hero {
      background: linear-gradient(
        135deg,
        var(--bs-primary-bg-subtle),
        var(--bs-body-bg) 60%
      );
    }
  `,
})
export class CvImport {
  private readonly store = inject(ProfileStore);
  private readonly modals = inject(NgbModal);

  /** Em destaque quando o perfil ainda está vazio. */
  readonly prominent = input(false);

  protected readonly accept = CV_LIMITS.acceptedExtensions.join(',');
  /** Que IA vai ler o CV, para o aviso antes do envio. */
  protected readonly reader = toSignal(this.store.cvReader$, {
    initialValue: null,
  });
  protected readonly analyzing = signal(false);
  protected readonly elapsed = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal<string | null>(null);
  /** A última importação foi feita sem IA (só palavras-chave). */
  protected readonly withoutAi = signal(false);

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Limpa a escolha: escolher o mesmo ficheiro outra vez volta a disparar o evento.
    input.value = '';
    if (!file) return;

    this.error.set(null);
    this.done.set(null);
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!(CV_LIMITS.acceptedExtensions as readonly string[]).includes(ext)) {
      this.error.set('O CV tem de ser um PDF ou um DOCX (Word).');
      return;
    }
    if (file.size > CV_LIMITS.maxFileBytes) {
      this.error.set('O ficheiro tem mais de 5 MB.');
      return;
    }

    this.analyzing.set(true);
    this.startTimer();
    this.store
      .analyzeCv(file)
      .pipe(
        finalize(() => {
          this.analyzing.set(false);
          this.stopTimer();
        }),
      )
      .subscribe({
        next: (draft) => {
          const ref = this.modals.open(CvReviewModal, {
            size: 'xl',
            scrollable: true,
            backdrop: 'static',
          });
          (ref.componentInstance as CvReviewModal).init(
            draft,
            this.store.profile(),
            this.store.projects(),
          );
          ref.result.then(
            (count: number) => {
              const items = `${count} ${count === 1 ? 'item' : 'itens'}`;
              this.done.set(
                draft.source === 'ai'
                  ? `Importado: ${items}. Revê o perfil abaixo.`
                  : `Importado: ${items}, sem IA (só competências e links). ${draft.warnings[0] ?? ''}`,
              );
              this.withoutAi.set(draft.source !== 'ai');
            },
            () => undefined,
          );
        },
        error: (e: ApiError) => this.error.set(e.message),
      });
  }

  private startTimer(): void {
    this.elapsed.set(0);
    this.timer = setInterval(() => this.elapsed.update((s) => s + 1), 1000);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
