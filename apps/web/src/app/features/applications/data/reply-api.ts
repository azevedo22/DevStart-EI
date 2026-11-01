import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AnalyzeReplyRequest, ReplyDraft } from '@devstart/shared-types';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

/** Leitura da resposta de uma empresa com IA. Não grava nada no servidor. */
@Injectable({ providedIn: 'root' })
export class ReplyApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  analyze(body: AnalyzeReplyRequest): Observable<ReplyDraft> {
    return this.http.post<ReplyDraft>(`${this.api}/jobs/replies/analyze`, body);
  }
}
