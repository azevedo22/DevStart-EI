import {
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Competency,
  INDUSTRY_PRACTICES,
  IndustryPractice,
  ORIGIN_LABELS,
  PRACTICE_LABELS,
  PROFILE_LIMITS,
  PROJECT_ORIGINS,
  Project,
  ProjectOrigin,
  SaveProjectRequest,
} from '@devstart/shared-types';
import { NgbActiveModal, NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import {
  Observable,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
} from 'rxjs';
import { CatalogApiService } from '../../../../core/catalog/catalog-api.service';
import { ApiError } from '../../../../core/http/error.interceptor';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { FieldError } from '../../../../shared/forms/field-error';

/** Só http(s), como no servidor: estes links acabam num href. */
const URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const URL_MESSAGE = { pattern: 'Começa por http:// ou https://.' };

const PRACTICE_HINTS: Record<IndustryPractice, string> = {
  DOCKER: 'Há um Dockerfile ou docker-compose',
  CI_CD: 'Testes ou deploy automáticos (ex.: GitHub Actions)',
  TESTS: 'Testes unitários, de integração ou e2e',
  CLEAN_ARCHITECTURE: 'Camadas separadas e regras de negócio isoladas',
  API_DOCS: 'OpenAPI/Swagger ou README com os endpoints',
};

/**
 * Criar ou editar um projeto. Aberto com NgbModal; fecha com o projeto guardado.
 * As regras (tamanhos, URLs, máximo de competências) vêm de @devstart/shared-types,
 * as mesmas que o servidor valida.
 */
@Component({
  selector: 'ds-project-form-modal',
  imports: [ReactiveFormsModule, NgbTypeahead, FieldError],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div class="modal-header">
        <h2 class="modal-title h5">
          {{ project ? 'Editar projeto' : 'Novo projeto' }}
        </h2>
        <button
          type="button"
          class="btn-close"
          aria-label="Fechar"
          (click)="modal.dismiss()"
        ></button>
      </div>

      <div class="modal-body vstack gap-3">
        @if (error(); as e) {
          <div class="alert alert-danger py-2 mb-0">{{ e }}</div>
        }

        <div>
          <label for="title" class="form-label">Nome do projeto</label>
          <input id="title" class="form-control" formControlName="title" />
          <ds-field-error [control]="form.controls.title" />
        </div>

        <fieldset>
          <legend class="form-label fs-6 mb-1">Origem</legend>
          <div class="btn-group w-100" role="group">
            @for (o of origins; track o) {
              <input
                type="radio"
                class="btn-check"
                formControlName="origin"
                [value]="o"
                [id]="'origin-' + o"
              />
              <label
                class="btn btn-outline-primary btn-sm"
                [for]="'origin-' + o"
                >{{ originLabels[o] }}</label
              >
            }
          </div>
        </fieldset>

        @if (isAcademic()) {
          <div>
            <label for="academicContext" class="form-label"
              >Contexto académico
              <span class="text-body-secondary">(opcional)</span></label
            >
            <input
              id="academicContext"
              class="form-control"
              formControlName="academicContext"
              placeholder="Ex.: Projeto final de licenciatura, 2026"
            />
            <ds-field-error [control]="form.controls.academicContext" />
          </div>
        }

        <div>
          <label for="description" class="form-label"
            >O que faz e qual foi o teu papel</label
          >
          <textarea
            id="description"
            class="form-control"
            rows="4"
            formControlName="description"
            placeholder="Problema que resolve, como funciona e o que fizeste tu."
          ></textarea>
          <div class="form-text text-end">
            {{ form.controls.description.value.length }}/{{
              limits.projectDescription
            }}
          </div>
          <ds-field-error
            [control]="form.controls.description"
            [messages]="{ minlength: 'Escreve pelo menos 10 caracteres.' }"
          />
        </div>

        <div class="row g-3">
          <div class="col-sm-6">
            <label for="repositoryUrl" class="form-label">Repositório</label>
            <input
              id="repositoryUrl"
              type="url"
              class="form-control"
              formControlName="repositoryUrl"
              placeholder="https://github.com/…"
            />
            <ds-field-error
              [control]="form.controls.repositoryUrl"
              [messages]="urlMessage"
            />
          </div>
          <div class="col-sm-6">
            <label for="liveUrl" class="form-label"
              >Demo <span class="text-body-secondary">(opcional)</span></label
            >
            <input
              id="liveUrl"
              type="url"
              class="form-control"
              formControlName="liveUrl"
              placeholder="https://…"
            />
            <ds-field-error
              [control]="form.controls.liveUrl"
              [messages]="urlMessage"
            />
          </div>
        </div>

        <div>
          <label for="competencySearch" class="form-label"
            >Competências que o projeto demonstra</label
          >
          <input
            #competencySearch
            id="competencySearch"
            type="search"
            class="form-control"
            placeholder="Procurar e adicionar…"
            [ngbTypeahead]="suggest"
            [inputFormatter]="emptyFormatter"
            [resultFormatter]="nameFormatter"
            [editable]="false"
            [disabled]="competencyIds().length >= limits.competenciesPerProject"
            (selectItem)="addCompetency($event.item); $event.preventDefault()"
          />
          <div class="d-flex flex-wrap gap-2 mt-2">
            @for (id of competencyIds(); track id) {
              @let declared = store.declaredIds().has(id);
              <span
                class="badge rounded-pill d-inline-flex align-items-center gap-1 fw-normal"
                [class.text-bg-primary]="declared"
                [class.chip-undeclared]="!declared"
                [title]="
                  declared
                    ? ''
                    : 'Não está no teu perfil: declara-a para contar no diagnóstico.'
                "
              >
                @if (!declared) {
                  <i class="bi bi-exclamation-circle"></i>
                }
                {{ catalog.nameOf(id) }}
                <button
                  type="button"
                  class="btn-close ms-1"
                  style="font-size: 0.55rem"
                  [class.btn-close-white]="declared"
                  [attr.aria-label]="'Remover ' + catalog.nameOf(id)"
                  (click)="removeCompetency(id)"
                ></button>
              </span>
            }
          </div>
          @if (hasUndeclared()) {
            <div class="form-text">
              <i class="bi bi-exclamation-circle me-1"></i>As marcadas não estão
              no teu perfil e não contam no diagnóstico até as declarares.
            </div>
          }
          <ds-field-error
            [control]="form.controls.competencyIds"
            [messages]="{ required: 'Indica pelo menos uma competência.' }"
          />
        </div>

        <fieldset>
          <legend class="form-label fs-6 mb-1">
            Práticas de indústria aplicadas
          </legend>
          <div class="row row-cols-1 row-cols-sm-2 g-1">
            @for (p of practices; track p) {
              <div class="col">
                <div class="form-check">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    [id]="'practice-' + p"
                    [checked]="hasPractice(p)"
                    (change)="togglePractice(p)"
                  />
                  <label class="form-check-label" [for]="'practice-' + p">
                    {{ practiceLabels[p] }}
                    <span class="d-block small text-body-secondary">{{
                      practiceHints[p]
                    }}</span>
                  </label>
                </div>
              </div>
            }
          </div>
        </fieldset>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-light" (click)="modal.dismiss()">
          Cancelar
        </button>
        <button type="submit" class="btn btn-primary" [disabled]="saving()">
          @if (saving()) {
            <span
              class="spinner-border spinner-border-sm me-2"
              aria-hidden="true"
            ></span>
          }
          {{ project ? 'Guardar alterações' : 'Adicionar projeto' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .chip-undeclared {
      background: var(--bs-warning-bg-subtle);
      color: var(--bs-warning-text-emphasis);
      border: 1px dashed var(--bs-warning-border-subtle);
    }
  `,
})
export class ProjectFormModal {
  protected readonly modal = inject(NgbActiveModal);
  protected readonly store = inject(ProfileStore);
  protected readonly catalog = inject(CatalogApiService);
  private readonly fb = inject(FormBuilder).nonNullable;

  /** Definido por quem abre o modal; sem projeto, é uma criação. */
  project: Project | null = null;

  protected readonly limits = PROFILE_LIMITS;
  protected readonly origins = PROJECT_ORIGINS;
  protected readonly originLabels = ORIGIN_LABELS;
  protected readonly practices = INDUSTRY_PRACTICES;
  protected readonly practiceLabels = PRACTICE_LABELS;
  protected readonly practiceHints = PRACTICE_HINTS;
  protected readonly urlMessage = URL_MESSAGE;

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly searchInput =
    viewChild.required<ElementRef<HTMLInputElement>>('competencySearch');

  protected readonly form = this.fb.group({
    title: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(PROFILE_LIMITS.projectTitle),
      ],
    ],
    origin: ['ACADEMIC' as ProjectOrigin, Validators.required],
    academicContext: ['', Validators.maxLength(PROFILE_LIMITS.academicContext)],
    description: [
      '',
      [
        Validators.required,
        Validators.minLength(10),
        Validators.maxLength(PROFILE_LIMITS.projectDescription),
      ],
    ],
    repositoryUrl: [
      '',
      [
        Validators.maxLength(PROFILE_LIMITS.url),
        Validators.pattern(URL_PATTERN),
      ],
    ],
    liveUrl: [
      '',
      [
        Validators.maxLength(PROFILE_LIMITS.url),
        Validators.pattern(URL_PATTERN),
      ],
    ],
    competencyIds: [[] as string[], Validators.required],
    practices: [[] as IndustryPractice[]],
  });

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  protected readonly isAcademic = computed(
    () => this.value().origin === 'ACADEMIC',
  );
  protected readonly competencyIds = computed(
    () => this.value().competencyIds ?? [],
  );
  protected readonly hasUndeclared = computed(() =>
    this.competencyIds().some((id) => !this.store.declaredIds().has(id)),
  );

  /** Chamado por quem abre o modal, depois de definir `project`. */
  init(project: Project | null): void {
    this.project = project;
    if (project) {
      this.form.reset({
        title: project.title,
        origin: project.origin,
        academicContext: project.academicContext ?? '',
        description: project.description,
        repositoryUrl: project.repositoryUrl ?? '',
        liveUrl: project.liveUrl ?? '',
        competencyIds: [...project.competencyIds],
        practices: [...project.practices],
      });
    }
  }

  protected readonly suggest = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(150),
      distinctUntilChanged(),
      map((term) => this.catalog.search(term, new Set(this.competencyIds()))),
    );
  protected readonly nameFormatter = (c: Competency) => c.name;
  protected readonly emptyFormatter = () => '';

  addCompetency(c: Competency): void {
    const ids = this.competencyIds();
    if (
      ids.includes(c.id) ||
      ids.length >= PROFILE_LIMITS.competenciesPerProject
    )
      return;
    this.form.controls.competencyIds.setValue([...ids, c.id]);
    this.form.controls.competencyIds.markAsTouched();
    // A caixa fica vazia para continuar a adicionar.
    queueMicrotask(() => (this.searchInput().nativeElement.value = ''));
  }

  removeCompetency(id: string): void {
    this.form.controls.competencyIds.setValue(
      this.competencyIds().filter((x) => x !== id),
    );
    this.form.controls.competencyIds.markAsTouched();
  }

  hasPractice(p: IndustryPractice): boolean {
    return (this.value().practices ?? []).includes(p);
  }

  togglePractice(p: IndustryPractice): void {
    const current = this.form.controls.practices.value;
    this.form.controls.practices.setValue(
      current.includes(p) ? current.filter((x) => x !== p) : [...current, p],
    );
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: SaveProjectRequest = {
      title: v.title,
      description: v.description,
      origin: v.origin,
      academicContext: v.origin === 'ACADEMIC' ? v.academicContext : null,
      repositoryUrl: v.repositoryUrl,
      liveUrl: v.liveUrl,
      competencyIds: v.competencyIds,
      practices: v.practices,
    };
    this.saving.set(true);
    this.error.set(null);
    this.store
      .saveProject(body, this.project?.id)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (saved) => this.modal.close(saved),
        error: (e: ApiError) => this.error.set(e.message),
      });
  }
}
