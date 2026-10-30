import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogApiService } from '../../../../core/catalog/catalog-api.service';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { BackgroundPanel } from '../../components/background-panel/background-panel';
import { CompetenciesPanel } from '../../components/competencies-panel/competencies-panel';
import { CvImport } from '../../components/cv-import/cv-import';
import { ProfileInfo } from '../../components/profile-info/profile-info';
import { ProjectsPanel } from '../../components/projects-panel/projects-panel';

/** Módulo 2 — Perfil & Proof of Work. */
@Component({
  selector: 'ds-profile-page',
  imports: [
    RouterLink,
    ProfileInfo,
    CompetenciesPanel,
    ProjectsPanel,
    BackgroundPanel,
    CvImport,
  ],
  template: `
    <div class="container py-4">
      @if (store.error(); as e) {
        <div
          class="alert alert-danger d-flex justify-content-between align-items-center"
        >
          <span>{{ e }}</span>
          <button
            type="button"
            class="btn btn-sm btn-outline-danger"
            (click)="store.load(true)"
          >
            Tentar de novo
          </button>
        </div>
      }
      @if (catalog.loadError(); as e) {
        <div class="alert alert-warning">{{ e }}</div>
      }

      @if (store.loaded()) {
        @if (welcome && isEmpty()) {
          <div class="alert alert-success d-flex align-items-center gap-2">
            <i class="bi bi-emoji-smile fs-5"></i>
            <span
              >Conta criada. O primeiro passo é preencher o perfil: o mais
              rápido é importar o teu CV.</span
            >
          </div>
        }
        <!-- Uma só instância: muda de aspeto quando o perfil deixa de estar
             vazio, e a mensagem de sucesso da importação não se perde. -->
        <ds-cv-import [prominent]="isEmpty()" class="d-block mb-3" />

        <ds-profile-info />

        @if (proof(); as p) {
          <div
            class="alert alert-light border d-flex flex-wrap align-items-center gap-2 mt-3 mb-0"
          >
            <i class="bi bi-shield-check text-primary fs-5"></i>
            <span class="me-auto">
              <strong>{{ p.withProject }} de {{ p.total }}</strong> competências
              já têm um projeto que as demonstra.
              @if (p.total > p.withProject) {
                <span class="text-body-secondary"
                  >As que estão a amarelo são o caminho mais rápido para
                  reforçar o portfólio.</span
                >
              }
            </span>
            <a routerLink="/skill-gap" class="btn btn-sm btn-primary"
              >Ver diagnóstico</a
            >
          </div>
        }

        <ds-background-panel class="d-block mt-4" />

        <div class="row g-4 mt-0">
          <div class="col-lg-5">
            <ds-competencies-panel />
          </div>
          <div class="col-lg-7">
            <ds-projects-panel />
          </div>
        </div>
      } @else if (store.loading()) {
        <div class="text-center py-5 text-body-secondary">
          <span
            class="spinner-border spinner-border-sm me-2"
            aria-hidden="true"
          ></span
          >A carregar o teu perfil…
        </div>
      }
    </div>
  `,
})
export class ProfilePage {
  protected readonly store = inject(ProfileStore);
  protected readonly catalog = inject(CatalogApiService);

  /** Definido pelo registo (navegação com state). */
  protected readonly welcome = !!history.state?.welcome;

  /** Perfil acabado de criar: nada declarado ainda. */
  protected readonly isEmpty = computed(() => {
    const p = this.store.profile();
    return (
      !!p &&
      !p.competencies.length &&
      !p.education.length &&
      !p.experience.length &&
      !this.store.projects().length
    );
  });

  protected readonly proof = computed(() => {
    const declared = this.store.competencies();
    if (!declared.length) return null;
    const withProjects = this.store.competenciesWithProjects();
    return {
      total: declared.length,
      withProject: declared.filter((c) => withProjects.has(c.competencyId))
        .length,
    };
  });

  constructor() {
    this.store.load();
  }
}
