import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Espera que a sessão seja restaurada no arranque antes de decidir,
 * para não mandar para o login quem já tem sessão e só recarregou a página.
 */
function whenKnown() {
  const auth = inject(AuthService);
  return toObservable(auth.status).pipe(
    filter((s) => s !== 'unknown'),
    take(1),
  );
}

/** Rotas que exigem sessão. */
export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return whenKnown().pipe(
    map((status) =>
      status === 'authenticated'
        ? true
        : router.createUrlTree(['/login'], {
            queryParams: { returnUrl: state.url },
          }),
    ),
  );
};

/** Login e registo: quem já tem sessão não precisa de os ver. */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return whenKnown().pipe(
    map((status) =>
      status === 'anonymous' ? true : router.createUrlTree(['/']),
    ),
  );
};

/** Só aceita caminhos internos, para um returnUrl não servir de redireccionamento para outro site. */
export function safeReturnUrl(value: string | null | undefined): string {
  return value && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/';
}
