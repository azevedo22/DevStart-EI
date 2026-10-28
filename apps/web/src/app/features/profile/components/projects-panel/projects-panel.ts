import { Component, inject, signal } from '@angular/core';
import {
  ORIGIN_LABELS,
  PRACTICE_LABELS,
  PROFILE_LIMITS,
  Project,
} from '@devstart/shared-types';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CatalogApiService } from '../../../../core/catalog/catalog-api.service';
import { ApiError } from '../../../../core/http/error.interceptor';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { confirmAction } from '../../../../shared/components/confirm-modal/confirm-modal';
import { ProjectFormModal } from '../project-form-modal/project-form-modal';

/** Projetos do utilizador: a prova de que as competências declaradas existem. */
@Component({
  selector: 'ds-projects-panel',
  template: `
    <section class="card border-0 shadow-sm h-100">
      <div class="card-body p-4">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <h2 class="h5 mb-0">Projetos</h2>
          <button
            type="button"
            class="btn btn-sm btn-primary"
            (click)="open()"
            [disabled]="store.projects().length >= limits.projectsPerUser"
          >
            <i class="bi bi-plus-lg me-1"></i>Novo projeto
          </button>
        </div>
        <p class="small text-body-secondary">
          Trabalhos da faculdade contam. O que importa é mostrares o que fizeste
          e com que tecnologias.
        </p>

        @if (error(); as e) {
          <div class="alert alert-danger py-2">{{ e }}</div>
        }

        @if (!store.projects().length) {
          <div
            class="text-center text-body-secondary border border-dashed rounded-3 py-5 px-3"
          >
            <i class="bi bi-folder2-open d-block fs-2 mb-2"></i>
            <p class="mb-3">
              Ainda sem projetos. O teu projeto final de curso é um ótimo
              primeiro.
            </p>
            <button
              type="button"
              class="btn btn-outline-primary btn-sm"
              (click)="open()"
            >
              Adicionar o primeiro
            </button>
          </div>
        }

        <div class="vstack gap-3">
          @for (p of store.projects(); track p.id) {
            <article class="border rounded-3 p-3">
              <div
                class="d-flex justify-content-between align-items-start gap-2"
              >
                <div>
                  <h3 class="h6 mb-1">{{ p.title }}</h3>
                  <span class="badge text-bg-light">{{
                    originLabels[p.origin]
                  }}</span>
                  @if (p.academicContext) {
                    <span class="small text-body-secondary ms-1">{{
                      p.academicContext
                    }}</span>
                  }
                </div>
                <div class="d-flex gap-1 flex-shrink-0">
                  <button
                    type="button"
                    class="btn btn-sm btn-light"
                    (click)="open(p)"
                    [attr.aria-label]="'Editar ' + p.title"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-light text-danger"
                    (click)="remove(p)"
                    [attr.aria-label]="'Apagar ' + p.title"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>

              <p class="small mt-2 mb-2 text-body-secondary description">
                {{ p.description }}
              </p>

              <div class="d-flex flex-wrap gap-1 mb-2">
                @for (id of p.competencyIds; track id) {
                  <span
                    class="badge rounded-pill fw-normal"
                    [class.text-bg-primary]="store.declaredIds().has(id)"
                    [class.undeclared]="!store.declaredIds().has(id)"
                    [title]="
                      store.declaredIds().has(id)
                        ? ''
                        : 'Não está no teu perfil'
                    "
                    >{{ catalog.nameOf(id) }}</span
                  >
                }
              </div>

              @if (p.practices.length) {
                <div class="small text-body-secondary mb-2">
                  <i class="bi bi-patch-check me-1"></i>
                  @for (pr of p.practices; track pr; let last = $last) {
                    {{ practiceLabels[pr] }}{{ last ? '' : ' · ' }}
                  }
                </div>
              }

              <div class="d-flex gap-3 small">
                @if (p.repositoryUrl) {
                  <a
                    [href]="p.repositoryUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    ><i class="bi bi-github me-1"></i>Repositório</a
                  >
                }
                @if (p.liveUrl) {
                  <a
                    [href]="p.liveUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    ><i class="bi bi-box-arrow-up-right me-1"></i>Demo</a
                  >
                }
              </div>
            </article>
          }
        </div>
      </div>
    </section>
  `,
  styles: `
    .border-dashed {
      border-style: dashed !important;
    }
    .undeclared {
      background: var(--bs-warning-bg-subtle);
      color: var(--bs-warning-text-emphasis);
      border: 1px dashed var(--bs-warning-border-subtle);
    }
    .description {
      white-space: pre-line;
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `,
})
export class ProjectsPanel {
  protected readonly store = inject(ProfileStore);
  protected readonly catalog = inject(CatalogApiService);
  private readonly modals = inject(NgbModal);

  protected readonly limits = PROFILE_LIMITS;
  protected readonly originLabels = ORIGIN_LABELS;
  protected readonly practiceLabels = PRACTICE_LABELS;
  protected readonly error = signal<string | null>(null);

  open(project?: Project): void {
    const ref = this.modals.open(ProjectFormModal, {
      size: 'lg',
      scrollable: true,
      backdrop: 'static',
    });
    (ref.componentInstance as ProjectFormModal).init(project ?? null);
  }

  async remove(project: Project): Promise<void> {
    const ok = await confirmAction(this.modals, {
      title: 'Apagar projeto',
      message: `"${project.title}" vai ser apagado. Esta ação não se pode desfazer.`,
      confirmLabel: 'Apagar',
      danger: true,
    });
    if (!ok) return;
    this.error.set(null);
    this.store
      .deleteProject(project.id)
      .subscribe({ error: (e: ApiError) => this.error.set(e.message) });
  }
}
