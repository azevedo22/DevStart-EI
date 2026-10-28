import { Routes } from '@angular/router';

export const SKILL_GAP_ROUTES: Routes = [
  {
    path: '',
    title: 'Skill Gap · DevStart EI',
    loadComponent: () =>
      import('./pages/skill-gap-page/skill-gap-page').then(
        (m) => m.SkillGapPage,
      ),
  },
];
