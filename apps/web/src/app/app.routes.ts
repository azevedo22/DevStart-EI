import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guards';

/** Cada feature é carregada sob demanda (lazy loading). */
export const appRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'DevStart EI',
    loadComponent: () =>
      import('./features/home/pages/home-page/home-page').then(
        (m) => m.HomePage,
      ),
  },
  // Login e registo ficam na raiz: /login, /register
  {
    path: '',
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  // Público: dá para experimentar o diagnóstico sem conta.
  {
    path: 'skill-gap',
    loadChildren: () =>
      import('./features/skill-gap/skill-gap.routes').then(
        (m) => m.SKILL_GAP_ROUTES,
      ),
  },
  // Protegido: dados pessoais.
  {
    path: 'profile',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
  },
  {
    path: 'applications',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/applications/applications.routes').then(
        (m) => m.APPLICATIONS_ROUTES,
      ),
  },
  {
    path: 'account',
    title: 'A minha conta · DevStart EI',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/pages/account-page/account-page').then(
        (m) => m.AccountPage,
      ),
  },
  { path: '**', redirectTo: '' },
];
