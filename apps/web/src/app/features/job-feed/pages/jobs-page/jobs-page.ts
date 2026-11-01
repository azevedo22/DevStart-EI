import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  APPLICATION_STATUSES,
  ApplicationStatus,
  JobFeedItem,
  JobFeedQuery,
  JobFeedResponse,
} from '@devstart/shared-types';
import { finalize } from 'rxjs';
import { CatalogApiService } from '../../../../core/catalog/catalog-api.service';
import { ApiError } from '../../../../core/http/error.interceptor';
import { ApplicationsStore } from '../../../applications/data/applications-store';
import { JobCard } from '../../components/job-card/job-card';
import { JobFilters } from '../../components/job-filters/job-filters';
import { JobFeedStore } from '../../data/job-feed-store';
import {
  ago,
  compact,
  filtersActive,
  toApplication,
} from '../../job-feed.util';

/**
 * Vagas para ti: o feed com os filtros da última visita, as vagas novas
 * marcadas e o caminho até ao quadro (candidatar-me ou guardar para depois).
 * Os filtros e cada vaga são componentes próprios; aqui ficam o estado e os
 * pedidos.
 */
@Component({
  selector: 'ds-jobs-page',
  imports: [RouterLink, JobFilters, JobCard],
  template: `
    <div class="container py-4">
      <div
        class="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3"
      >
        <div>
          <h1 class="h3 mb-1">Vagas para ti</h1>
          <p class="text-body-secondary mb-0 small">
            Vagas de entrada publicadas no
            <a
              href="https://www.itjobs.pt"
              target="_blank"
              rel="noopener noreferrer"
              >ITJobs.pt</a
            >, atualizadas de 3 em 3 horas e ordenadas pelo teu perfil.
            @if (data()?.lastSyncAt; as at) {
              Última atualização {{ ago(at) }}.
            }
          </p>
        </div>
        <a routerLink="/applications" class="btn btn-sm btn-outline-secondary">
          <i class="bi bi-kanban me-1"></i>As minhas candidaturas
        </a>
      </div>

      <ds-job-filters
        [query]="query()"
        [stacks]="catalog.stacks()"
        (queryChange)="load($event)"
      />

      @if (error(); as e) {
        <div class="alert alert-danger" role="alert">{{ e }}</div>
      }
      @if (actionError(); as e) {
        <div class="alert alert-warning alert-dismissible" role="alert">
          {{ e }}
          <button
            type="button"
            class="btn-close"
            aria-label="Fechar"
            (click)="actionError.set(null)"
          ></button>
        </div>
      }

      @if (loading() && !data()) {
        <div class="text-center py-5 text-body-secondary" role="status">
          <span class="spinner-border spinner-border-sm me-2"></span>A carregar
          vagas…
        </div>
      } @else if (data(); as d) {
        @if (!d.enabled && !d.totalOpen) {
          <div class="alert alert-info">
            <i class="bi bi-info-circle me-1"></i>A recolha de vagas está
            desligada: falta a chave da API do ITJobs.pt (<code
              >ITJOBS_API_KEY</code
            >
            no <code>.env</code>).
          </div>
        } @else if (d.enabled && !d.totalOpen) {
          <div class="alert alert-info">
            <i class="bi bi-hourglass-split me-1"></i>A primeira recolha de
            vagas está a decorrer. Volta daqui a um minuto.
          </div>
        } @else {
          <p class="small text-body-secondary mb-2" role="status">
            {{ d.items.length }} {{ d.items.length === 1 ? 'vaga' : 'vagas' }}
            @if (newIds().size) {
              ·
              <span class="text-success fw-semibold"
                >{{ newIds().size }}
                {{ newIds().size === 1 ? 'nova' : 'novas' }}</span
              >
              desde a última visita
            }
            @if (loading()) {
              <span class="spinner-border spinner-border-sm ms-2"></span>
            }
          </p>
          @if (!d.items.length) {
            <div class="text-center py-5 text-body-secondary">
              Nenhuma vaga com estes filtros.
              @if (filtersActive()) {
                <button
                  type="button"
                  class="btn btn-link p-0 align-baseline"
                  (click)="load({})"
                >
                  Limpar filtros
                </button>
              }
            </div>
          }
          <div class="vstack gap-3">
            @for (j of d.items; track j.id) {
              <ds-job-card
                [job]="j"
                [isNew]="newIds().has(j.id)"
                [inBoard]="boardUrls().get(j.url)"
                [confirming]="confirming() === j.id"
                [busy]="busy().has(j.id)"
                (openToApply)="openToApply(j)"
                (applied)="addToBoard(j, 'APPLIED')"
                (saved)="addToBoard(j, 'SAVED')"
                (notYet)="confirming.set(null)"
              />
            }
          </div>
        }
      }
    </div>
  `,
})
export class JobsPage {
  protected readonly catalog = inject(CatalogApiService);
  private readonly feedStore = inject(JobFeedStore);
  private readonly applications = inject(ApplicationsStore);

  protected readonly ago = ago;

  protected readonly query = signal<JobFeedQuery>({});
  protected readonly data = signal<JobFeedResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly busy = signal<ReadonlySet<string>>(new Set());
  /** A vaga cujo anúncio foi aberto e espera a confirmação da candidatura. */
  protected readonly confirming = signal<string | null>(null);
  /**
   * As vagas novas na primeira lista desta visita. A visita fica registada logo
   * a seguir, por isso mudar de filtros já não as marcaria: guardam-se aqui.
   */
  protected readonly newIds = signal<ReadonlySet<string>>(new Set());
  private requestSeq = 0;

  /** Vagas que já estão no quadro, pelo link do anúncio → coluna. */
  protected readonly boardUrls = computed(() => {
    const board = this.applications.board();
    const map = new Map<string, ApplicationStatus>();
    if (!board) return map;
    for (const s of APPLICATION_STATUSES)
      for (const a of board[s]) if (a.jobUrl) map.set(a.jobUrl, s);
    return map;
  });

  protected readonly filtersActive = computed(() =>
    filtersActive(this.query()),
  );

  constructor() {
    this.applications.load();
    // Abre com os filtros da última visita.
    this.feedStore.lastQuery().subscribe({
      next: (q) => this.load(q ?? {}, true),
      error: () => this.load({}, true),
    });
  }

  protected load(q: JobFeedQuery, first = false): void {
    const clean = compact(q);
    this.query.set(clean);
    this.loading.set(true);
    this.error.set(null);
    const seq = ++this.requestSeq;
    this.feedStore
      .feed(clean)
      .pipe(finalize(() => seq === this.requestSeq && this.loading.set(false)))
      .subscribe({
        next: (d) => {
          if (seq !== this.requestSeq) return; // chegou depois de outro pedido
          this.data.set(d);
          if (first)
            this.newIds.set(
              new Set(d.items.filter((i) => i.isNew).map((i) => i.id)),
            );
          this.feedStore.markVisited(clean);
        },
        error: (e: ApiError) => {
          if (seq === this.requestSeq) this.error.set(e.message);
        },
      });
  }

  /**
   * Abre o anúncio no ITJobs.pt (no clique, para o browser não o bloquear) e
   * pergunta se a candidatura foi feita. Abrir o anúncio não é candidatar-se:
   * o utilizador pode ler e desistir. Só "Sim, regista" cria o cartão.
   */
  protected openToApply(job: JobFeedItem): void {
    window.open(job.url, '_blank', 'noopener');
    this.confirming.set(job.id);
  }

  protected addToBoard(job: JobFeedItem, status: ApplicationStatus): void {
    this.actionError.set(null);
    this.busy.update((s) => new Set(s).add(job.id));
    this.applications
      .create(toApplication(job, status, this.applications.today()))
      .pipe(
        finalize(() =>
          this.busy.update((s) => {
            const next = new Set(s);
            next.delete(job.id);
            return next;
          }),
        ),
      )
      .subscribe({
        next: () => {
          if (this.confirming() === job.id) this.confirming.set(null);
        },
        error: (e: ApiError) =>
          this.actionError.set(
            `Não foi possível juntar "${job.title}" ao quadro: ${e.message}`,
          ),
      });
  }
}
