import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ApplicationStats, Profile } from '@devstart/shared-types';
import {
  Observable,
  catchError,
  defer,
  forkJoin,
  map,
  of,
  repeat,
  switchMap,
  take,
  filter,
  timeout,
} from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { API_BASE_URL } from '../config/api.config';

const POLL_MS = 300;
const MAX_WAIT_MS = 6_000;

/**
 * "Experimentar sem registo".
 *
 * O Auth Service cria a conta e os outros serviços preenchem-na com dados de
 * exemplo quando recebem o evento `user.demo-created`. Isso é assíncrono:
 * normalmente demora uma fração de segundo. Antes de mostrar a aplicação,
 * espera-se que os dados cheguem, para o visitante não ver as páginas vazias.
 * Se demorarem mais do que MAX_WAIT_MS, segue-se na mesma.
 */
@Injectable({ providedIn: 'root' })
export class DemoLauncher {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly auth = inject(AuthService);

  start(): Observable<void> {
    return this.auth.startDemo().pipe(
      switchMap(() => this.waitForSampleData()),
      map(() => undefined),
    );
  }

  private waitForSampleData(): Observable<unknown> {
    const ready$ = defer(() =>
      forkJoin([
        this.http.get<Profile>(`${this.base}/profile`),
        this.http.get<ApplicationStats>(`${this.base}/applications/stats`),
      ]),
    ).pipe(
      map(
        ([profile, stats]) =>
          profile.competencies.length > 0 && stats.total > 0,
      ),
      repeat({ delay: POLL_MS }),
      filter(Boolean),
      take(1),
    );
    return ready$.pipe(
      timeout(MAX_WAIT_MS),
      catchError(() => of(false)),
    );
  }
}
