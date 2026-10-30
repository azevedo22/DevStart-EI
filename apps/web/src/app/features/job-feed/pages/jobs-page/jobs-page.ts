import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  APPLICATION_LIMITS,
  APPLICATION_STATUSES,
  ApplicationStatus,
  JOB_CONTRACTS,
  JOB_LOCATIONS,
  JobFeedItem,
  JobFeedQuery,
  JobFeedResponse,
  SENIORITY_LABELS,
  SaveApplicationRequest,
  WORK_MODE_LABELS,
} from '@devstart/shared-types';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { finalize } from 'rxjs';
import { CatalogApiService } from '../../../../core/catalog/catalog-api.service';
import { ApiError } from '../../../../core/http/error.interceptor';
import { AccessibilityBadge } from '../../../applications/components/accessibility-badge/accessibility-badge';
import { ApplicationsStore } from '../../../applications/data/applications-store';
import { JobFeedStore } from '../../data/job-feed-store';

/** Os distritos mais procurados aparecem primeiro na lista. */
const MAIN_LOCATIONS = [18, 14, 4, 8, 1];

/** "há 3 dias", "hoje", "ontem". */
export function ago(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return minutes <= 1 ? 'agora mesmo' : `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ontem';
  return days < 30 ? `há ${days} dias` : `há ${Math.floor(days / 30)} meses`;
}

/** O cartão do Kanban a partir de uma vaga do feed. */
export function toApplication(
  job: JobFeedItem,
  status: ApplicationStatus,
  today: string,
): SaveApplicationRequest {
  return {
    companyName: job.companyName.slice(0, APPLICATION_LIMITS.companyName),
    jobTitle: job.title.slice(0, APPLICATION_LIMITS.jobTitle),
    jobUrl: job.url,
    location:
      job.locations.join(', ').slice(0, APPLICATION_LIMITS.location) || null,
    workMode: job.workMode ?? 'ONSITE',
    requiredCompetencyIds: job.competencyIds.slice(
      0,
      APPLICATION_LIMITS.competencies,
    ),
    yearsRequired: job.yearsRequired,
    experienceRequirements: job.experienceRequirements.slice(
      0,
      APPLICATION_LIMITS.experienceItems,
    ),
    seniority: job.seniority,
    appliedAt: today,
    notes: 'Vaga encontrada no ITJobs.pt através da DevStart EI.',
    status,
  };
}

@Component({
  selector: 'ds-jobs-page',
  imports: [RouterLink, NgbDropdownModule, AccessibilityBadge],
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

      <!-- Filtros -->
      <section class="card border-0 shadow-sm mb-3">
        <div class="card-body d-flex flex-wrap align-items-center gap-2">
          <div ngbDropdown [autoClose]="'outside'">
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              ngbDropdownToggle
            >
              <i class="bi bi-geo-alt me-1"></i>{{ locationLabel() }}
            </button>
            <div ngbDropdownMenu class="p-2 locations-menu">
              <div class="form-check">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="loc-remote"
                  [checked]="query().remote"
                  (change)="toggleRemote()"
                />
                <label class="form-check-label" for="loc-remote">
                  <i class="bi bi-house-door me-1"></i>Remoto
                </label>
              </div>
              <hr class="my-2" />
              @for (l of locations; track l.id) {
                <div class="form-check">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    [id]="'loc-' + l.id"
                    [checked]="query().locations?.includes(l.id)"
                    (change)="toggle('locations', l.id)"
                  />
                  <label class="form-check-label" [for]="'loc-' + l.id">{{
                    l.name
                  }}</label>
                </div>
              }
            </div>
          </div>

          <div ngbDropdown [autoClose]="'outside'">
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              ngbDropdownToggle
            >
              <i class="bi bi-file-earmark-text me-1"></i>{{ contractLabel() }}
            </button>
            <div ngbDropdownMenu class="p-2">
              @for (c of contracts; track c.id) {
                <div class="form-check text-nowrap">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    [id]="'ct-' + c.id"
                    [checked]="query().contracts?.includes(c.id)"
                    (change)="toggle('contracts', c.id)"
                  />
                  <label class="form-check-label" [for]="'ct-' + c.id">{{
                    c.name
                  }}</label>
                </div>
              }
            </div>
          </div>

          <select
            class="form-select form-select-sm w-auto"
            aria-label="Stack alvo"
            [value]="query().stackId ?? ''"
            (change)="setStack($any($event.target).value)"
          >
            <option value="">Todas as stacks</option>
            @for (s of catalog.stacks(); track s.id) {
              <option [value]="s.id">{{ s.title }}</option>
            }
          </select>

          <div class="form-check form-switch ms-sm-auto mb-0">
            <input
              class="form-check-input"
              type="checkbox"
              role="switch"
              id="unrealistic"
              [checked]="query().includeUnrealistic"
              (change)="
                patch({ includeUnrealistic: !query().includeUnrealistic })
              "
            />
            <label class="form-check-label small" for="unrealistic"
              >Mostrar pouco realistas</label
            >
          </div>
          @if (filtersActive()) {
            <button
              type="button"
              class="btn btn-sm btn-link"
              (click)="clearFilters()"
            >
              Limpar filtros
            </button>
          }
        </div>
      </section>

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
                  (click)="clearFilters()"
                >
                  Limpar filtros
                </button>
              }
            </div>
          }
          <div class="vstack gap-3">
            @for (j of d.items; track j.id) {
              @let inBoard = boardUrls().get(j.url);
              <article
                class="card border-0 shadow-sm"
                [class.new-job]="newIds().has(j.id)"
              >
                <div class="card-body">
                  <div class="d-flex flex-wrap align-items-start gap-2">
                    <div class="me-auto" style="min-width: 0">
                      <h2 class="h6 mb-1">
                        @if (newIds().has(j.id)) {
                          <span class="badge text-bg-success me-1">Nova</span>
                        }
                        <a
                          [href]="j.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="link-body-emphasis"
                          >{{ j.title }}</a
                        >
                      </h2>
                      <div class="small text-body-secondary">
                        <strong class="text-body">{{ j.companyName }}</strong>
                        @if (j.locations.length) {
                          · <i class="bi bi-geo-alt"></i>
                          {{ j.locations.join(', ') }}
                        }
                        @if (j.workMode) {
                          · {{ workModeLabels[j.workMode] }}
                        }
                        · {{ ago(j.publishedAt) }}
                      </div>
                    </div>
                    @if (j.matchPercentage !== null) {
                      <div class="text-end">
                        <div
                          class="fs-5 fw-semibold lh-1"
                          [class]="matchClass(j.matchPercentage)"
                        >
                          {{ j.matchPercentage }}%
                        </div>
                        <div class="tiny text-body-secondary">
                          do teu perfil
                        </div>
                      </div>
                    }
                  </div>

                  <div
                    class="d-flex flex-wrap align-items-center gap-2 small mt-2"
                  >
                    <ds-accessibility-badge
                      [value]="j.accessibility"
                      [mislabeled]="j.mislabeledJunior"
                      [years]="j.yearsRequired"
                    />
                    @if (levelText(j); as t) {
                      <span class="text-body-secondary">{{ t }}</span>
                    }
                  </div>

                  <p class="small text-body-secondary mt-2 mb-2 summary">
                    {{ j.summary }}
                  </p>

                  @if (j.competencyIds.length) {
                    <div class="d-flex flex-wrap gap-1 mb-2">
                      @for (id of j.matched; track id) {
                        <span
                          class="badge rounded-pill text-bg-success fw-normal"
                          ><i class="bi bi-check2 me-1"></i
                          >{{ catalog.nameOf(id) }}</span
                        >
                      }
                      @for (id of j.missing; track id) {
                        <span
                          class="badge rounded-pill text-bg-light border fw-normal"
                          >{{ catalog.nameOf(id) }}</span
                        >
                      }
                    </div>
                  }
                  @if (j.experienceRequirements.length) {
                    <ul class="small mb-2 ps-3">
                      @for (
                        e of j.experienceRequirements.slice(0, 4);
                        track $index
                      ) {
                        <li>{{ e }}</li>
                      }
                    </ul>
                  }

                  <div class="d-flex flex-wrap align-items-center gap-2 pt-1">
                    @if (inBoard) {
                      <span class="badge text-bg-light border fw-normal py-2">
                        <i class="bi bi-kanban me-1"></i>No teu quadro:
                        {{ statusLabel(inBoard) }}
                      </span>
                      <a
                        [href]="j.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="btn btn-sm btn-link"
                      >
                        Ver anúncio
                      </a>
                    } @else {
                      <button
                        type="button"
                        class="btn btn-sm btn-primary"
                        [disabled]="busy().has(j.id)"
                        (click)="apply(j)"
                        title="Abre o anúncio no ITJobs.pt e junta a candidatura ao quadro"
                      >
                        <i class="bi bi-send me-1"></i>Candidatar-me
                      </button>
                      <button
                        type="button"
                        class="btn btn-sm btn-outline-secondary"
                        [disabled]="busy().has(j.id)"
                        (click)="save(j)"
                      >
                        <i class="bi bi-bookmark me-1"></i>Guardar para depois
                      </button>
                    }
                    <span class="ms-auto tiny text-body-secondary">
                      {{
                        j.analyzedBy === 'ai'
                          ? 'Lida pela IA'
                          : 'Triagem automática'
                      }}
                      · via ITJobs.pt
                    </span>
                  </div>
                </div>
              </article>
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    .tiny {
      font-size: 0.72rem;
    }
    .summary {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .new-job {
      box-shadow:
        inset 3px 0 0 var(--bs-success),
        var(--bs-box-shadow-sm) !important;
    }
    .locations-menu {
      max-height: 22rem;
      overflow-y: auto;
    }
  `,
})
export class JobsPage {
  protected readonly catalog = inject(CatalogApiService);
  private readonly feedStore = inject(JobFeedStore);
  private readonly applications = inject(ApplicationsStore);

  protected readonly locations = [
    ...JOB_LOCATIONS.filter((l) => MAIN_LOCATIONS.includes(l.id)).sort(
      (a, b) => MAIN_LOCATIONS.indexOf(a.id) - MAIN_LOCATIONS.indexOf(b.id),
    ),
    ...JOB_LOCATIONS.filter((l) => !MAIN_LOCATIONS.includes(l.id)),
  ];
  protected readonly contracts = JOB_CONTRACTS;
  protected readonly workModeLabels = WORK_MODE_LABELS;
  protected readonly ago = ago;

  protected readonly query = signal<JobFeedQuery>({});
  protected readonly data = signal<JobFeedResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly busy = signal<ReadonlySet<string>>(new Set());
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

  protected readonly filtersActive = computed(() => {
    const q = this.query();
    return !!(
      q.locations?.length ||
      q.remote ||
      q.contracts?.length ||
      q.stackId ||
      q.includeUnrealistic
    );
  });

  protected readonly locationLabel = computed(() => {
    const q = this.query();
    const names = (q.locations ?? []).map(
      (id) => JOB_LOCATIONS.find((l) => l.id === id)?.name ?? '',
    );
    if (q.remote) names.unshift('Remoto');
    if (!names.length) return 'Todo o país';
    return names.length <= 2 ? names.join(' ou ') : `${names.length} locais`;
  });

  protected readonly contractLabel = computed(() => {
    const ids = this.query().contracts ?? [];
    if (!ids.length) return 'Qualquer contrato';
    return ids.length === 1
      ? (JOB_CONTRACTS.find((c) => c.id === ids[0])?.name ?? '')
      : `${ids.length} contratos`;
  });

  constructor() {
    this.applications.load();
    // Abre com os filtros da última visita.
    this.feedStore.lastQuery().subscribe({
      next: (q) => this.load(q ?? {}, true),
      error: () => this.load({}, true),
    });
  }

  protected patch(change: Partial<JobFeedQuery>): void {
    this.load({ ...this.query(), ...change });
  }

  protected toggle(key: 'locations' | 'contracts', id: number): void {
    const current = this.query()[key] ?? [];
    this.patch({
      [key]: current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id],
    });
  }

  protected toggleRemote(): void {
    this.patch({ remote: !this.query().remote });
  }

  protected setStack(id: string): void {
    this.patch({ stackId: id || undefined });
  }

  protected clearFilters(): void {
    this.load({});
  }

  private load(q: JobFeedQuery, first = false): void {
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

  /** Abre o anúncio (no clique, para o browser não o bloquear) e junta ao quadro. */
  protected apply(job: JobFeedItem): void {
    window.open(job.url, '_blank', 'noopener');
    this.addToBoard(job, 'APPLIED');
  }

  protected save(job: JobFeedItem): void {
    this.addToBoard(job, 'SAVED');
  }

  private addToBoard(job: JobFeedItem, status: ApplicationStatus): void {
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
        error: (e: ApiError) =>
          this.actionError.set(
            `Não foi possível juntar "${job.title}" ao quadro: ${e.message}`,
          ),
      });
  }

  /** "Júnior · sem experiência", "Estágio", "2+ anos de experiência". */
  protected levelText(j: JobFeedItem): string {
    const parts: string[] = [];
    if (j.seniority !== 'UNKNOWN') parts.push(SENIORITY_LABELS[j.seniority]);
    if (j.yearsRequired !== null)
      parts.push(
        j.yearsRequired === 0
          ? 'sem experiência'
          : `${j.yearsRequired}+ anos de experiência`,
      );
    return parts.join(' · ');
  }

  protected statusLabel(s: ApplicationStatus): string {
    return s === 'SAVED' ? 'por candidatar' : 'já te candidataste';
  }

  protected matchClass(p: number): string {
    return p >= 70
      ? 'text-success'
      : p >= 40
        ? 'text-warning-emphasis'
        : 'text-danger';
  }
}

/** Tira os filtros vazios: a query guardada e o pedido ficam limpos. */
function compact(q: JobFeedQuery): JobFeedQuery {
  const out: JobFeedQuery = {};
  if (q.locations?.length)
    out.locations = [...q.locations].sort((a, b) => a - b);
  if (q.remote) out.remote = true;
  if (q.contracts?.length)
    out.contracts = [...q.contracts].sort((a, b) => a - b);
  if (q.stackId) out.stackId = q.stackId;
  if (q.includeUnrealistic) out.includeUnrealistic = true;
  return out;
}
