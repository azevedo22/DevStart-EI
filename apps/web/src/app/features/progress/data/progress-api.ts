import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ActivityEvent } from '@devstart/shared-types';
import { Observable, forkJoin, map } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

/** O fuso do browser, para os serviços contarem os dias como o utilizador. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Atividade por dia: candidaturas, respostas e entrevistas vêm do tracker;
 * projetos do profile. Os dois pedidos seguem em paralelo e juntam-se aqui.
 */
@Injectable({ providedIn: 'root' })
export class ProgressApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  activity(from: string, to: string): Observable<ActivityEvent[]> {
    const params = new HttpParams()
      .set('from', from)
      .set('to', to)
      .set('tz', browserTimeZone());
    return forkJoin([
      this.http.get<ActivityEvent[]>(`${this.api}/applications/activity`, {
        params,
      }),
      this.http.get<ActivityEvent[]>(`${this.api}/projects/activity`, {
        params,
      }),
    ]).pipe(map(([tracker, projects]) => [...tracker, ...projects]));
  }
}
