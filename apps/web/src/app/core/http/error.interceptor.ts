import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export interface ApiError {
  status: number;
  message: string;
}

/**
 * Normaliza os erros HTTP para um formato único, para os componentes
 * não terem de conhecer o formato de erro do NestJS.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const apiError: ApiError = {
        status: err.status,
        message:
          err.status === 0
            ? 'Não foi possível contactar o servidor. Confirma que o API Gateway está a correr.'
            : (err.error?.message ?? err.message),
      };
      return throwError(() => apiError);
    }),
  );
