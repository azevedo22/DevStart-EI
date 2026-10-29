import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UserDto,
} from '@devstart/shared-types';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  tap,
} from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

/**
 * Estado da sessão no frontend.
 *
 * - O access token vive só em memória (nunca em localStorage), por isso um script
 *   injetado não o consegue ler depois de recarregar a página.
 * - A sessão sobrevive a um refresh da página graças ao cookie httpOnly:
 *   ao arrancar, `restoreSession()` pede um novo access token.
 * - Só existe um refresh em curso de cada vez. Com rotação de tokens, dois refresh
 *   em paralelo pareceriam reutilização ao servidor, que revogaria a sessão.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/auth`;

  private readonly _user = signal<UserDto | null>(null);
  private readonly _status = signal<AuthStatus>('unknown');
  private accessToken: string | null = null;
  private refreshInFlight: Observable<AuthResponse> | null = null;

  readonly user = this._user.asReadonly();
  readonly status = this._status.asReadonly();
  readonly isAuthenticated = computed(() => this._status() === 'authenticated');
  /** Conta de demonstração: dados de exemplo, apagada automaticamente. */
  readonly isDemo = computed(() => !!this._user()?.demoExpiresAt);

  getAccessToken(): string | null {
    return this.accessToken;
  }

  register(body: RegisterRequest): Observable<UserDto> {
    return this.http.post<AuthResponse>(`${this.url}/register`, body).pipe(
      tap((res) => this.setSession(res)),
      map((res) => res.user),
    );
  }

  login(body: LoginRequest): Observable<UserDto> {
    return this.http.post<AuthResponse>(`${this.url}/login`, body).pipe(
      tap((res) => this.setSession(res)),
      map((res) => res.user),
    );
  }

  /** Cria uma conta de demonstração (dados de exemplo) e abre a sessão. */
  startDemo(): Observable<UserDto> {
    return this.http.post<AuthResponse>(`${this.url}/demo`, {}).pipe(
      tap((res) => this.setSession(res)),
      map((res) => res.user),
    );
  }

  /** Pede um novo access token usando o cookie. Pedidos simultâneos partilham o mesmo pedido. */
  refresh(): Observable<AuthResponse> {
    this.refreshInFlight ??= this.http
      .post<AuthResponse>(`${this.url}/refresh`, {})
      .pipe(
        tap({
          next: (res) => this.setSession(res),
          error: () => this.clearSession(),
        }),
        finalize(() => (this.refreshInFlight = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.refreshInFlight;
  }

  /** Chamado uma vez no arranque da aplicação. Nunca falha: sem sessão, fica anónimo. */
  restoreSession(): Observable<void> {
    return this.refresh().pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
    );
  }

  /**
   * Apaga a conta. Pede a password, exceto numa conta de demonstração.
   * A sessão local termina logo a seguir.
   */
  deleteAccount(password?: string): Observable<void> {
    return this.http
      .delete<void>(`${this.url}/me`, { body: password ? { password } : {} })
      .pipe(tap(() => this.clearSession()));
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.url}/logout`, {}).pipe(
      catchError(() => of(undefined)), // mesmo que o servidor falhe, a sessão local termina
      finalize(() => this.clearSession()),
      map(() => undefined),
    );
  }

  /** Termina a sessão local sem falar com o servidor (ex.: refresh recusado). */
  clearSession(): void {
    this.accessToken = null;
    this._user.set(null);
    this._status.set('anonymous');
  }

  private setSession(res: AuthResponse): void {
    this.accessToken = res.accessToken;
    this._user.set(res.user);
    this._status.set('authenticated');
  }
}
