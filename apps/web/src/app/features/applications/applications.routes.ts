import { Routes } from '@angular/router';

export const APPLICATIONS_ROUTES: Routes = [
  {
    path: '',
    title: 'Candidaturas · DevStart EI',
    loadComponent: () =>
      import('./pages/kanban-page/kanban-page').then((m) => m.KanbanPage),
  },
];
