import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgbCollapse, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { JobFeedStore } from '../../../features/job-feed/data/job-feed-store';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'ds-navbar',
  imports: [RouterLink, RouterLinkActive, NgbCollapse, NgbDropdownModule],
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
          <ul class="navbar-nav ms-auto align-items-md-center">
            @for (link of links; track link.path) {
              <li class="nav-item">
                <a
                  class="nav-link"
                  [routerLink]="link.path"
                  routerLinkActive="active fw-semibold"
                  (click)="collapsed.set(true)"
                >
                  <i class="bi {{ link.icon }} me-1"></i>{{ link.label }}
                  @if (link.path === '/jobs' && jobs.newCount() > 0) {
                    <span
                      class="badge rounded-pill text-bg-success ms-1"
                      [title]="jobs.newCount() + ' vagas novas para ti'"
                      >{{ jobs.newCount() }}</span
                    >
                  }
                </a>
              </li>
            }

            @switch (auth.status()) {
              @case ('authenticated') {
                <li
                  class="nav-item ms-md-3"
                  ngbDropdown
                  display="dynamic"
                  placement="bottom-end"
                >
                  <button
                    type="button"
                    class="btn btn-light btn-sm d-flex align-items-center gap-2"
                    ngbDropdownToggle
                  >
                    <span
                      class="avatar rounded-circle bg-primary text-white fw-semibold"
                      >{{ initials() }}</span
                    >
                    <span>{{ firstName() }}</span>
                  </button>
                  <div ngbDropdownMenu>
                    <div class="dropdown-item-text small text-body-secondary">
                      {{ auth.user()?.email }}
                    </div>
                    <div class="dropdown-divider"></div>
                    <a
                      ngbDropdownItem
                      routerLink="/account"
                      (click)="collapsed.set(true)"
                    >
                      <i class="bi bi-gear me-2"></i>A minha conta
                    </a>
                    <button ngbDropdownItem (click)="logout()">
                      <i class="bi bi-box-arrow-right me-2"></i>Terminar sessão
                    </button>
                  </div>
                </li>
              }
              @case ('anonymous') {
                <li class="nav-item ms-md-3 d-flex gap-2 py-2 py-md-0">
                  <a
                    routerLink="/login"
                    class="btn btn-sm btn-outline-primary"
                    (click)="collapsed.set(true)"
                    >Entrar</a
                  >
                  <a
                    routerLink="/register"
                    class="btn btn-sm btn-primary"
                    (click)="collapsed.set(true)"
                    >Criar conta</a
                  >
                </li>
              }
            }
          </ul>
        </div>
      </div>
    </nav>
  `,
  styles: `
    .avatar {
      width: 1.75rem;
      height: 1.75rem;
      display: inline-grid;
      place-items: center;
      font-size: 0.75rem;
    }
  `,
})
export class Navbar {
  protected readonly auth = inject(AuthService);
  /** Número de vagas novas desde a última visita à secção Vagas. */
  protected readonly jobs = inject(JobFeedStore);
  private readonly router = inject(Router);

  protected readonly collapsed = signal(true);
  protected readonly links = [
    { path: '/skill-gap', label: 'Skill Gap', icon: 'bi-bar-chart-steps' },
    {
      path: '/profile',
      label: 'Perfil & Projetos',
      icon: 'bi-person-workspace',
    },
    { path: '/jobs', label: 'Vagas', icon: 'bi-search' },
    { path: '/applications', label: 'Candidaturas', icon: 'bi-kanban' },
    { path: '/progress', label: 'Progresso', icon: 'bi-graph-up' },
  ];

  protected readonly firstName = computed(
    () => this.auth.user()?.fullName.split(' ')[0] ?? '',
  );
  protected readonly initials = computed(() => {
    const parts = (this.auth.user()?.fullName ?? '').split(' ').filter(Boolean);
    return (
      (parts[0]?.[0] ?? '') +
      (parts.length > 1 ? parts[parts.length - 1][0] : '')
    ).toUpperCase();
  });

  logout(): void {
    this.collapsed.set(true);
    this.auth.logout().subscribe(() => this.router.navigateByUrl('/'));
  }
}
