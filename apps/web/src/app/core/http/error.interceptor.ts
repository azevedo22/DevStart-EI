import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export interface ApiError {
  status: number;
  message: string;
  /** Mensagens de validação por campo, quando o backend as devolve em lista. */
  details: string[];
}

/**
 * Normaliza os erros HTTP para um formato único, para os componentes
 * não terem de conhecer o formato de erro do NestJS.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => throwError(() => toApiError(err))),
  );

export function toApiError(err: HttpErrorResponse): ApiError {
  const raw = err.error?.message;
  const details = Array.isArray(raw) ? raw.map(String) : [];

  let message: string;
  if (err.status === 0) {
    message =
      'Não foi possível contactar o servidor. Confirma que o API Gateway está a correr.';
  } else if (err.status === 429) {
    message = 'Demasiadas tentativas. Espera um minuto e tenta de novo.';
  } else if (details.length) {
    message = details[0];
  } else {
    message = typeof raw === 'string' ? raw : err.message;
  }
  return { status: err.status, message, details };
}
