import { Routes } from '@angular/router';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    title: 'Perfil & Projetos · DevStart EI',
    loadComponent: () =>
      import('./pages/profile-page/profile-page').then((m) => m.ProfilePage),
  },
];
