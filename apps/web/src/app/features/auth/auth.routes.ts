import { Routes } from '@angular/router';
import { guestGuard } from '../../core/auth/auth.guards';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    title: 'Entrar · DevStart EI',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/login-page/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    title: 'Criar conta · DevStart EI',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/register-page/register-page').then((m) => m.RegisterPage),
  },
];
