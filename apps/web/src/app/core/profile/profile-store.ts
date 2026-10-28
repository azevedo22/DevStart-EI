import { HttpClient } from '@angular/common/http';
import {
  Injectable,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import {
  Level,
  Profile,
  ProfileCompetency,
  Project,
  SaveProjectRequest,
  UpdateProfileRequest,
} from '@devstart/shared-types';
import { Observable, finalize, forkJoin, tap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { API_BASE_URL } from '../config/api.config';
import { ApiError } from '../http/error.interceptor';

/**
 * Estado do perfil e dos projetos do utilizador, partilhado entre a página
 * de perfil e o diagnóstico de skill gap.
 *
 * Os componentes leem signals e chamam métodos; só esta classe fala com a API.
 * As escritas atualizam o estado com a resposta do servidor (a fonte de verdade),
 * em vez de adivinharem o resultado.
 */
@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly auth = inject(AuthService);

  private readonly _profile = signal<Profile | null>(null);
  private readonly _projects = signal<Project[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private loadedFor: string | null = null;

  readonly profile = this._profile.asReadonly();
  readonly projects = this._projects.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loaded = computed(() => this._profile() !== null);

  readonly competencies = computed<ProfileCompetency[]>(
    () => this._profile()?.competencies ?? [],
  );
  readonly declaredIds = computed(
    () => new Set(this.competencies().map((c) => c.competencyId)),
  );

  /** Quantos projetos demonstram cada competência. */
  readonly projectCountByCompetency = computed(() => {
    const counts = new Map<string, number>();
    for (const p of this._projects()) {
      for (const id of p.competencyIds)
        counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  });

  readonly competenciesWithProjects = computed(
    () => new Set(this.projectCountByCompetency().keys()),
  );

  constructor() {
    // Os dados são de uma pessoa: ao mudar de utilizador (ou terminar sessão), esquece-se tudo.
    effect(() => {
      const userId = this.auth.user()?.id ?? null;
      untracked(() => {
        if (userId !== this.loadedFor) this.reset();
      });
    });
  }

  /** Carrega uma vez por sessão; `force` volta a pedir. */
  load(force = false): void {
    const userId = this.auth.user()?.id;
    if (!userId || this._loading() || (this.loaded() && !force)) return;

    this._loading.set(true);
    this._error.set(null);
    forkJoin({
      profile: this.http.get<Profile>(`${this.base}/profile`),
      projects: this.http.get<Project[]>(`${this.base}/projects`),
    })
      .pipe(finalize(() => this._loading.set(false)))
      .subscribe({
        next: ({ profile, projects }) => {
          this.loadedFor = userId;
          this._profile.set(profile);
          this._projects.set(projects);
        },
        error: (e: ApiError) => this._error.set(e.message),
      });
  }

  updateInfo(changes: UpdateProfileRequest): Observable<Profile> {
    return this.http
      .put<Profile>(`${this.base}/profile`, changes)
      .pipe(tap((p) => this._profile.set(p)));
  }

  declareCompetency(
    competencyId: string,
    level: Level,
  ): Observable<ProfileCompetency[]> {
    return this.http
      .put<ProfileCompetency[]>(
        `${this.base}/profile/competencies/${encodeURIComponent(competencyId)}`,
        { level },
      )
      .pipe(tap((list) => this.setCompetencies(list)));
  }

  removeCompetency(competencyId: string): Observable<void> {
    return this.http
      .delete<void>(
        `${this.base}/profile/competencies/${encodeURIComponent(competencyId)}`,
      )
      .pipe(
        tap(() =>
          this.setCompetencies(
            this.competencies().filter((c) => c.competencyId !== competencyId),
          ),
        ),
      );
  }

  saveProject(body: SaveProjectRequest, id?: string): Observable<Project> {
    const req = id
      ? this.http.put<Project>(`${this.base}/projects/${id}`, body)
      : this.http.post<Project>(`${this.base}/projects`, body);
    return req.pipe(
      // O mais recente primeiro, como o servidor ordena.
      tap((saved) =>
        this._projects.update((list) => [
          saved,
          ...list.filter((p) => p.id !== saved.id),
        ]),
      ),
    );
  }

  deleteProject(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.base}/projects/${id}`)
      .pipe(
        tap(() =>
          this._projects.update((list) => list.filter((p) => p.id !== id)),
        ),
      );
  }

  /** Para o diagnóstico: o perfil no formato que calculateSkillGap espera. */
  readonly gapInput = computed(() => ({
    competencies: this.competencies().map((c) => ({
      competencyId: c.competencyId,
      level: c.level,
    })),
    withProjects: this.competenciesWithProjects(),
  }));

  private setCompetencies(list: ProfileCompetency[]): void {
    this._profile.update((p) => (p ? { ...p, competencies: list } : p));
  }

  private reset(): void {
    this.loadedFor = null;
    this._profile.set(null);
    this._projects.set([]);
    this._error.set(null);
  }
}
