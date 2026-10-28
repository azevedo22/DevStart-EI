import { Routes } from '@angular/router';

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
  {
    path: 'skill-gap',
    loadChildren: () =>
      import('./features/skill-gap/skill-gap.routes').then(
        (m) => m.SKILL_GAP_ROUTES,
      ),
  },
  {
    path: 'profile',
    loadChildren: () =>
      import('./features/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
  },
  {
    path: 'applications',
    loadChildren: () =>
      import('./features/applications/applications.routes').then(
        (m) => m.APPLICATIONS_ROUTES,
      ),
  },
  { path: '**', redirectTo: '' },
];
