import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AuthService } from './auth.service';

/** Endpoints que gerem a própria sessão: não levam token nem disparam refresh. */
const SESSION_ENDPOINTS = /\/auth\/(login|register|refresh|logout)$/;

/**
 * 1. Junta o access token aos pedidos para a nossa API (e só para ela).
 * 2. Se a API responder 401, tenta UM refresh e repete o pedido original.
 * 3. Se o refresh falhar, a sessão acabou: vai para o login e volta depois.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const apiBase = inject(API_BASE_URL);

  const isApi = req.url.startsWith(apiBase);
  if (!isApi || SESSION_ENDPOINTS.test(req.url)) return next(req);

  return next(withToken(req, auth.getAccessToken())).pipe(
    // Pode chegar como HttpErrorResponse ou já normalizado pelo errorInterceptor: ambos têm `status`.
    catchError((err: Pick<HttpErrorResponse, 'status'>) => {
      if (err.status !== 401) return throwError(() => err);

      return auth.refresh().pipe(
        catchError((refreshErr) => {
          router.navigate(['/login'], {
            queryParams: { returnUrl: router.url },
          });
          return throwError(() => refreshErr);
        }),
        switchMap((res) => next(withToken(req, res.accessToken))),
      );
    }),
  );
};

function withToken(
  req: HttpRequest<unknown>,
  token: string | null,
): HttpRequest<unknown> {
  return token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;
}
