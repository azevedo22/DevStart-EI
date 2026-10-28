import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt-PT';
import {
  ApplicationConfig,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { errorInterceptor } from './core/http/error.interceptor';

// Datas e números em português de Portugal ("28 out. 2026").
registerLocaleData(localePt);

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'pt-PT' },
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding()),
    // Ordem importa: o authInterceptor fica por fora para ver o 401 e repetir o pedido.
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, errorInterceptor]),
    ),
    // Recupera a sessão a partir do cookie antes da primeira navegação.
    provideAppInitializer(() => inject(AuthService).restoreSession()),
  ],
};
