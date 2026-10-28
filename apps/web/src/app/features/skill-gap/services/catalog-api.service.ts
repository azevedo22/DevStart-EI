import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Competency, TargetStack } from '@devstart/shared-types';
import { Observable, shareReplay } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

/**
 * Catálogo de competências e stacks (Profile & Skill Service).
 * Muda raramente, por isso é pedido uma vez e partilhado com shareReplay(1).
 */
@Injectable({ providedIn: 'root' })
export class CatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  readonly competencies$: Observable<Competency[]> = this.http
    .get<Competency[]>(`${this.baseUrl}/competencies`)
    .pipe(shareReplay(1));

  readonly stacks$: Observable<TargetStack[]> = this.http
    .get<TargetStack[]>(`${this.baseUrl}/stacks`)
    .pipe(shareReplay(1));
}
