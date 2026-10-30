import { HttpClient } from '@angular/common/http';
import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import {
  APPLICATION_STATUSES,
  Accessibility,
  DailyGoalProgress,
  dailyGoalProgress,
  localDate,
  ApplicationBoard,
  ApplicationStats,
  ApplicationStatus,
  Interview,
  JobApplication,
  JobApplicationDetail,
  SaveApplicationRequest,
  SaveInterviewRequest,
} from '@devstart/shared-types';
import { Observable, finalize, forkJoin, tap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { API_BASE_URL } from '../../../core/config/api.config';
import { ApiError } from '../../../core/http/error.interceptor';

const emptyBoard = (): ApplicationBoard =>
  Object.fromEntries(
    APPLICATION_STATUSES.map((s) => [s, [] as JobApplication[]]),
  ) as ApplicationBoard;

/**
 * Estado do quadro de candidaturas.
 *
 * Mover um cartão é otimista: o quadro muda logo e o pedido segue em fundo,
 * porque esperar pelo servidor num drag & drop parece lento. Se falhar, o
 * quadro volta exatamente ao que era. O algoritmo de posições é o mesmo do
 * servidor, por isso o estado local e o guardado coincidem.
 */
@Injectable({ providedIn: 'root' })
export class ApplicationsStore {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly base = `${this.api}/applications`;
  private readonly interviewsBase = `${this.api}/interviews`;
  private readonly auth = inject(AuthService);

  private readonly _board = signal<ApplicationBoard | null>(null);
  private readonly _stats = signal<ApplicationStats | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private loadedFor: string | null = null;

  readonly board = this._board.asReadonly();
  readonly stats = this._stats.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loaded = computed(() => this._board() !== null);

  // ── Objetivo diário ─────────────────────────────────────────
  /** O dia de hoje no fuso do utilizador; muda sozinho à meia-noite. */
  private readonly today = signal(localDate());

  /**
   * Progresso no objetivo de candidaturas de hoje. Calculado a partir do
   * quadro, por isso atualiza no instante em que uma candidatura é criada.
   */
  readonly dailyGoal = computed<DailyGoalProgress | null>(() => {
    const board = this._board();
    if (!board) return null;
    const dates = APPLICATION_STATUSES.flatMap((s) =>
      board[s].map((a) => a.appliedAt),
    );
    return dailyGoalProgress(dates, this.today());
  });

  // ── Filtros (aplicados no cliente, para serem instantâneos) ──
  readonly search = signal('');
  readonly accessibilityFilter = signal<Accessibility | null>(null);
  readonly filtersActive = computed(
    () => !!this.search().trim() || this.accessibilityFilter() !== null,
  );

  readonly visibleBoard = computed<ApplicationBoard>(() => {
    const board = this._board() ?? emptyBoard();
    if (!this.filtersActive()) return board;
    const q = this.search().trim().toLowerCase();
    const acc = this.accessibilityFilter();
    const keep = (a: JobApplication) =>
      (!acc || a.accessibility === acc) &&
      (!q ||
        a.companyName.toLowerCase().includes(q) ||
        a.jobTitle.toLowerCase().includes(q));
    return Object.fromEntries(
      APPLICATION_STATUSES.map((s) => [s, board[s].filter(keep)]),
    ) as ApplicationBoard;
  });

  readonly total = computed(() => {
    const b = this._board();
    return b ? APPLICATION_STATUSES.reduce((n, s) => n + b[s].length, 0) : 0;
  });

  constructor() {
    // Dados pessoais: ao mudar de utilizador (ou terminar sessão), esquece-se tudo.
    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      untracked(() => {
        if (userId !== this.loadedFor) this.reset();
      });
    });
    // À meia-noite o objetivo recomeça: confirma o dia uma vez por minuto.
    const timer = setInterval(() => {
      const now = localDate();
      if (now !== this.today()) this.today.set(now);
    }, 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  load(force = false): void {
    const userId = this.auth.user()?.id;
    if (!userId || this._loading() || (this.loaded() && !force)) return;
    this._loading.set(true);
    this._error.set(null);
    forkJoin({
      board: this.http.get<ApplicationBoard>(`${this.base}/board`),
      stats: this.http.get<ApplicationStats>(`${this.base}/stats`),
    })
      .pipe(finalize(() => this._loading.set(false)))
      .subscribe({
        next: ({ board, stats }) => {
          this.loadedFor = userId;
          this._board.set(board);
          this._stats.set(stats);
        },
        error: (e: ApiError) => this._error.set(e.message),
      });
  }

  create(body: SaveApplicationRequest): Observable<JobApplication> {
    return this.http.post<JobApplication>(this.base, body).pipe(
      tap((created) => {
        // Entra no topo da coluna, como no servidor.
        this.updateBoard((b) => {
          b[created.status] = renumber([created, ...b[created.status]]);
        });
        this.refreshStats();
      }),
    );
  }

  update(id: string, body: SaveApplicationRequest): Observable<JobApplication> {
    return this.http.put<JobApplication>(`${this.base}/${id}`, body).pipe(
      tap((saved) => {
        this.updateBoard((b) => {
          b[saved.status] = b[saved.status].map((a) =>
            a.id === saved.id ? saved : a,
          );
        });
        this.refreshStats();
      }),
    );
  }

  /** Move otimista. Devolve uma promessa que resolve com sucesso ou erro, para a UI avisar. */
  move(id: string, status: ApplicationStatus, position: number): Promise<void> {
    const before = this._board();
    if (!before) return Promise.resolve();
    const card = APPLICATION_STATUSES.flatMap((s) => before[s]).find(
      (a) => a.id === id,
    );
    if (!card || (card.status === status && card.position === position))
      return Promise.resolve();

    this._board.set(applyMove(before, card, status, position));
    this._error.set(null);

    return new Promise((resolve, reject) => {
      this.http
        .patch<JobApplication>(`${this.base}/${id}/move`, { status, position })
        .subscribe({
          next: (saved) => {
            this.updateBoard((b) => {
              b[saved.status] = b[saved.status].map((a) =>
                a.id === saved.id ? saved : a,
              );
            });
            if (card.status !== status) this.refreshStats();
            resolve();
          },
          error: (e: ApiError) => {
            this._board.set(before); // desfaz exatamente o que mudou
            this._error.set(
              `Não foi possível mover a candidatura: ${e.message}`,
            );
            reject(e);
          },
        });
    });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`).pipe(
      tap(() => {
        this.updateBoard((b) => {
          for (const s of APPLICATION_STATUSES)
            b[s] = renumber(b[s].filter((a) => a.id !== id));
        });
        this.refreshStats();
      }),
    );
  }

  detail(id: string): Observable<JobApplicationDetail> {
    return this.http.get<JobApplicationDetail>(`${this.base}/${id}`);
  }

  saveInterview(
    applicationId: string,
    body: SaveInterviewRequest,
    interviewId?: string,
  ): Observable<Interview> {
    const req = interviewId
      ? this.http.put<Interview>(`${this.interviewsBase}/${interviewId}`, body)
      : this.http.post<Interview>(
          `${this.base}/${applicationId}/interviews`,
          body,
        );
    return req.pipe(
      tap(() => this.afterInterviewChange(applicationId, interviewId ? 0 : +1)),
    );
  }

  deleteInterview(
    applicationId: string,
    interviewId: string,
  ): Observable<void> {
    return this.http
      .delete<void>(`${this.interviewsBase}/${interviewId}`)
      .pipe(tap(() => this.afterInterviewChange(applicationId, -1)));
  }

  private afterInterviewChange(applicationId: string, delta: number): void {
    if (delta) {
      this.updateBoard((b) => {
        for (const s of APPLICATION_STATUSES) {
          b[s] = b[s].map((a) =>
            a.id === applicationId
              ? { ...a, interviewCount: a.interviewCount + delta }
              : a,
          );
        }
      });
    }
    this.refreshStats();
  }

  private refreshStats(): void {
    this.http
      .get<ApplicationStats>(`${this.base}/stats`)
      .subscribe({ next: (s) => this._stats.set(s), error: () => undefined });
  }

  private updateBoard(mutate: (board: ApplicationBoard) => void): void {
    const current = this._board();
    if (!current) return;
    const copy = { ...current };
    mutate(copy);
    this._board.set(copy);
  }

  private reset(): void {
    this.loadedFor = null;
    this._board.set(null);
    this._stats.set(null);
    this._error.set(null);
    this.search.set('');
    this.accessibilityFilter.set(null);
  }
}

/** Posições 0..n-1 pela ordem do array (o mesmo invariante do servidor). */
function renumber(cards: JobApplication[]): JobApplication[] {
  return cards.map((c, i) => (c.position === i ? c : { ...c, position: i }));
}

/** O mesmo movimento que o servidor faz, aplicado localmente. Exportado para os testes. */
export function applyMove(
  board: ApplicationBoard,
  card: JobApplication,
  status: ApplicationStatus,
  position: number,
): ApplicationBoard {
  const next = { ...board };
  const source = board[card.status].filter((a) => a.id !== card.id);
  const target = card.status === status ? source : [...board[status]];
  const index = Math.max(0, Math.min(position, target.length));
  target.splice(index, 0, { ...card, status });
  next[card.status] = renumber(source);
  next[status] = renumber(target);
  return next;
}
