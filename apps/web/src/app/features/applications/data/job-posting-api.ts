import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  AnalyzeJobPostingRequest,
  JobPostingDraft,
} from '@devstart/shared-types';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

/** Análise do texto de um anúncio com IA (no Profile Service, que tem o catálogo). */
@Injectable({ providedIn: 'root' })
export class JobPostingApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  analyze(text: string): Observable<JobPostingDraft> {
    const body: AnalyzeJobPostingRequest = { text };
    return this.http.post<JobPostingDraft>(`${this.api}/jobs/analyze`, body);
  }
}
