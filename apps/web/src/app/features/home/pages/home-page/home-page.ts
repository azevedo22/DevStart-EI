import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { DailyGoal } from '../../../applications/components/daily-goal/daily-goal';
import { DailyQuote } from '../../../applications/components/daily-quote/daily-quote';
import { DemoButton } from '../../../demo/components/demo-button/demo-button';

@Component({
  selector: 'ds-home-page',
  imports: [RouterLink, DemoButton, DailyGoal, DailyQuote],
  template: `
    <div class="container py-5">
      @if (accountDeleted) {
        <div
          class="alert alert-success d-flex align-items-center gap-2"
          role="status"
        >
          <i class="bi bi-check-circle"></i>
          A tua conta e todos os teus dados foram apagados.
        </div>
      }
      @if (demoEnded) {
        <div
          class="alert alert-success d-flex align-items-center gap-2"
          role="status"
        >
          <i class="bi bi-check-circle"></i>
          A demonstração terminou e os dados de exemplo foram apagados.
        </div>
      }
      @if (auth.isAuthenticated()) {
        <ds-daily-quote class="d-block mb-3" />
        <ds-daily-goal [showLink]="true" class="d-block mb-5" />
      }
      <div class="row justify-content-center text-center">
        <div class="col-lg-8">
          <h1 class="display-6 fw-semibold">
            Passo a passo, até ao primeiro «sim».
          </h1>
          <p class="lead text-body-secondary mt-3">
            Para estudantes e recém-formados em informática. Descobre o que te
            falta, mostra o que já sabes com projetos e acompanha cada
            candidatura, com objetivos diários que te mantêm em movimento.
          </p>
          <div
            class="d-flex flex-wrap justify-content-center align-items-start gap-2 mt-3"
          >
            <a routerLink="/skill-gap" class="btn btn-primary btn-lg">
              <i class="bi bi-bar-chart-steps me-2"></i>Fazer diagnóstico
            </a>
            @if (!auth.isAuthenticated()) {
              <ds-demo-button btnClass="btn-outline-primary btn-lg" />
            }
          </div>
          @if (!auth.isAuthenticated()) {
            <p class="small text-body-secondary mt-3 mb-0">
              A demonstração cria uma conta só tua, com um perfil, projetos e
              candidaturas de exemplo. É apagada automaticamente ao fim de 24
              horas.
            </p>
          }
        </div>
      </div>

      <div class="row g-4 mt-4">
        @for (m of modules; track m.title) {
          <div class="col-md-4">
            <a
              [routerLink]="m.path"
              class="card h-100 border-0 shadow-sm text-decoration-none text-body"
            >
              <div class="card-body">
                <i class="bi {{ m.icon }} fs-3 text-primary"></i>
                <h2 class="h5 mt-2">{{ m.title }}</h2>
                <p class="text-body-secondary mb-0">{{ m.text }}</p>
              </div>
            </a>
          </div>
        }
      </div>
    </div>
  `,
})
export class HomePage {
  /** Definido pela página de conta ao apagar (navegação com state). */
  protected readonly accountDeleted = !!history.state?.accountDeleted;
  /** Definido pelo aviso de demonstração ao terminar. */
  protected readonly demoEnded = !!history.state?.demoEnded;
  protected readonly auth = inject(AuthService);

  protected readonly modules = [
    {
      path: '/skill-gap',
      icon: 'bi-bar-chart-steps',
      title: 'Skill Gap',
      text: 'Compara o teu perfil com uma stack júnior e recebe a checklist do que falta.',
    },
    {
      path: '/profile',
      icon: 'bi-person-workspace',
      title: 'Proof of Work',
      text: 'Liga cada competência a um projeto que a demonstre.',
    },
    {
      path: '/applications',
      icon: 'bi-kanban',
      title: 'Candidaturas',
      text: 'Acompanha cada processo, do envio do CV à proposta.',
    },
  ];
}
