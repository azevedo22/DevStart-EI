import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'ds-navbar',
  imports: [RouterLink, RouterLinkActive, NgbCollapse],
  template: `
    <nav class="navbar navbar-expand-md bg-white border-bottom">
      <div class="container">
        <a class="navbar-brand fw-semibold" routerLink="/">
          <i class="bi bi-rocket-takeoff text-primary me-1"></i>DevStart EI
        </a>
        <button
          class="navbar-toggler"
          type="button"
          aria-label="Abrir menu"
          (click)="collapsed.set(!collapsed())"
        >
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="navbar-collapse" [ngbCollapse]="collapsed()">
          <ul class="navbar-nav ms-auto">
            @for (link of links; track link.path) {
              <li class="nav-item">
                <a
                  class="nav-link"
                  [routerLink]="link.path"
                  routerLinkActive="active fw-semibold"
                  (click)="collapsed.set(true)"
                >
                  <i class="bi {{ link.icon }} me-1"></i>{{ link.label }}
                </a>
              </li>
            }
          </ul>
        </div>
      </div>
    </nav>
  `,
})
export class Navbar {
  protected readonly collapsed = signal(true);
  protected readonly links = [
    { path: '/skill-gap', label: 'Skill Gap', icon: 'bi-bar-chart-steps' },
    {
      path: '/profile',
      label: 'Perfil & Projetos',
      icon: 'bi-person-workspace',
    },
    { path: '/applications', label: 'Candidaturas', icon: 'bi-kanban' },
  ];
}
