import { HttpClient, HttpParams } from '@angular/common/http';
import {
  DestroyRef,
  Injectable,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import {
  JobFeedNewCount,
  JobFeedQuery,
  JobFeedResponse,
} from '@devstart/shared-types';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { API_BASE_URL } from '../../../core/config/api.config';

/** De quanto em quanto tempo o menu confirma se há vagas novas. */
const NEW_COUNT_REFRESH_MS = 15 * 60_000;

/**
 * Vagas do ITJobs.pt: o feed filtrado e o número de vagas novas para o menu.
 * O número atualiza-se ao entrar na sessão e de 15 em 15 minutos (a recolha
 * no servidor é de 3 em 3 horas, por isso mais do que isto não adianta).
 */
@Injectable({ providedIn: 'root' })
export class JobFeedStore {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = `${inject(API_BASE_URL)}/jobs/feed`;

  readonly newCount = signal(0);

  constructor() {
    effect(() => {
      const signedIn = this.auth.isAuthenticated();
      untracked(() =>
        signedIn ? this.refreshNewCount() : this.newCount.set(0),
      );
    });
    const timer = setInterval(() => {
      if (this.auth.isAuthenticated()) this.refreshNewCount();
    }, NEW_COUNT_REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  feed(q: JobFeedQuery): Observable<JobFeedResponse> {
    return this.http.get<JobFeedResponse>(this.base, { params: toParams(q) });
  }

  lastQuery(): Observable<JobFeedQuery | null> {
    return this.http.get<JobFeedQuery | null>(`${this.base}/last-query`);
  }

  /** O utilizador viu a lista: o que lá está deixa de ser novo. */
  markVisited(q: JobFeedQuery): void {
    this.newCount.set(0);
    this.http.put<void>(`${this.base}/visit`, q).subscribe({
      error: () => undefined, // não é grave: fica para a próxima visita
    });
  }

  refreshNewCount(): void {
    this.http.get<JobFeedNewCount>(`${this.base}/new-count`).subscribe({
      next: (r) => this.newCount.set(r.count),
      error: () => undefined,
    });
  }
}

/** Filtros → query string (listas separadas por vírgulas; omite o que está vazio). */
export function toParams(q: JobFeedQuery): HttpParams {
  let p = new HttpParams();
  if (q.locations?.length) p = p.set('locations', q.locations.join(','));
  if (q.remote) p = p.set('remote', 'true');
  if (q.contracts?.length) p = p.set('contracts', q.contracts.join(','));
  if (q.stackId) p = p.set('stackId', q.stackId);
  if (q.includeUnrealistic) p = p.set('includeUnrealistic', 'true');
  return p;
}
