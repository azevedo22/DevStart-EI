import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Competency, TargetStack } from '@devstart/shared-types';
import { Observable, catchError, of, shareReplay } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { ApiError } from '../http/error.interceptor';

/**
 * Catálogo de competências e stacks (Profile & Skill Service).
 * Muda raramente, por isso é pedido uma vez e partilhado por toda a aplicação.
 */
@Injectable({ providedIn: 'root' })
export class CatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Mensagem de erro se o catálogo não carregar (o resto da página continua a funcionar). */
  readonly loadError = signal<string | null>(null);

  readonly competencies$: Observable<Competency[]> = this.http
    .get<Competency[]>(`${this.baseUrl}/competencies`)
    .pipe(
      catchError((e: ApiError) => this.fail(e)),
      shareReplay(1),
    );

  readonly stacks$: Observable<TargetStack[]> = this.http
    .get<TargetStack[]>(`${this.baseUrl}/stacks`)
    .pipe(
      catchError((e: ApiError) => this.fail(e)),
      shareReplay(1),
    );

  readonly competencies = toSignal(this.competencies$, {
    initialValue: [] as Competency[],
  });
  readonly stacks = toSignal(this.stacks$, {
    initialValue: [] as TargetStack[],
  });

  private readonly byId = computed(
    () => new Map(this.competencies().map((c) => [c.id, c])),
  );

  competency(id: string): Competency | undefined {
    return this.byId().get(id);
  }

  /** Nome legível de uma competência; cai no id se o catálogo ainda não carregou. */
  nameOf(id: string): string {
    return this.byId().get(id)?.name ?? id;
  }

  /** Pesquisa por nome, id ou alias (ex.: "jest" encontra "Testes Unitários"). */
  search(term: string, exclude: ReadonlySet<string> = new Set()): Competency[] {
    const q = term.trim().toLowerCase();
    if (!q) return [];
    return this.competencies()
      .filter((c) => !exclude.has(c.id))
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.id.includes(q) ||
          c.aliases.some((a) => a.includes(q)),
      )
      .slice(0, 8);
  }

  private fail(e: ApiError) {
    this.loadError.set(e.message);
    return of([]);
  }
}
