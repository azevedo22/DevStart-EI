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
  APPLICATION_LIMITS,
  Competency,
  JobApplication,
  SENIORITIES,
  SENIORITY_LABELS,
  SaveApplicationRequest,
  Seniority,
  WORK_MODES,
  WORK_MODE_LABELS,
  WorkMode,
  analyzeJobPosting,
  classifyAccessibility,
  matchWithProfile,
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
import { ApplicationsStore } from '../../data/applications-store';
import { AccessibilityBadge } from '../accessibility-badge/accessibility-badge';

const URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const today = () => new Date().toISOString().slice(0, 10);

/** Criar ou editar uma candidatura, com análise automática do texto do anúncio. */
@Component({
  selector: 'ds-application-form-modal',
  imports: [ReactiveFormsModule, NgbTypeahead, FieldError, AccessibilityBadge],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div class="modal-header">
        <h2 class="modal-title h5">
          {{ application ? 'Editar candidatura' : 'Nova candidatura' }}
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

        <div class="row g-3">
          <div class="col-sm-6">
            <label for="companyName" class="form-label">Empresa</label>
            <input
              id="companyName"
              class="form-control"
              formControlName="companyName"
            />
            <ds-field-error [control]="form.controls.companyName" />
          </div>
          <div class="col-sm-6">
            <label for="jobTitle" class="form-label">Título da vaga</label>
            <input
              id="jobTitle"
              class="form-control"
              formControlName="jobTitle"
              placeholder="Ex.: Junior Frontend Developer"
            />
            <ds-field-error [control]="form.controls.jobTitle" />
          </div>
        </div>

        <details class="border rounded-3 p-3" [open]="!application">
          <summary class="fw-medium">
            <i class="bi bi-magic me-1 text-primary"></i>Analisar o anúncio
            <span class="small text-body-secondary fw-normal"
              >(opcional, preenche os campos abaixo)</span
            >
          </summary>
          <textarea
            #posting
            class="form-control mt-2"
            rows="5"
            aria-label="Texto do anúncio"
            placeholder="Cola aqui o texto completo da vaga: requisitos, anos de experiência, tecnologias…"
          ></textarea>
          <div class="d-flex align-items-center gap-2 mt-2">
            <button
              type="button"
              class="btn btn-sm btn-outline-primary"
              (click)="analyze(posting.value)"
            >
              Analisar
            </button>
            @if (analysisNote(); as note) {
              <span class="small text-body-secondary">{{ note }}</span>
            }
          </div>
        </details>

        <div class="row g-3">
          <div class="col-sm-6">
            <label for="seniority" class="form-label"
              >Senioridade indicada</label
            >
            <select
              id="seniority"
              class="form-select"
              formControlName="seniority"
            >
              @for (s of seniorities; track s) {
                <option [value]="s">{{ seniorityLabels[s] }}</option>
              }
            </select>
          </div>
          <div class="col-sm-6">
            <label for="yearsRequired" class="form-label"
              >Anos de experiência pedidos</label
            >
            <input
              id="yearsRequired"
              type="number"
              min="0"
              max="30"
              class="form-control"
              formControlName="yearsRequired"
              placeholder="Não indicado"
            />
            <ds-field-error
              [control]="form.controls.yearsRequired"
              [messages]="{ min: 'Valor inválido.', max: 'Valor inválido.' }"
            />
          </div>
        </div>

        <div class="d-flex flex-wrap align-items-center gap-2 small">
          <span class="text-body-secondary">Para quem tem 0 anos:</span>
          <ds-accessibility-badge
            [value]="verdict().accessibility"
            [mislabeled]="verdict().mislabeledJunior"
            [years]="value().yearsRequired ?? null"
          />
          <span class="text-body-secondary">{{
            verdict().reasons.join(' ')
          }}</span>
        </div>

        <div>
          <label for="competencySearch" class="form-label"
            >Competências pedidas</label
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
            (selectItem)="addCompetency($event.item); $event.preventDefault()"
          />
          <div class="d-flex flex-wrap gap-2 mt-2">
            @for (id of competencyIds(); track id) {
              @let have = profile.declaredIds().has(id);
              <span
                class="badge rounded-pill fw-normal d-inline-flex align-items-center gap-1"
                [class.text-bg-success]="have"
                [class.text-bg-light]="!have"
                [class.border]="!have"
                [title]="
                  have ? 'Está no teu perfil' : 'Ainda não está no teu perfil'
                "
              >
                @if (have) {
                  <i class="bi bi-check2"></i>
                }
                {{ catalog.nameOf(id) }}
                <button
                  type="button"
                  class="btn-close ms-1"
                  style="font-size: 0.55rem"
                  [class.btn-close-white]="have"
                  [attr.aria-label]="'Remover ' + catalog.nameOf(id)"
                  (click)="removeCompetency(id)"
                ></button>
              </span>
            }
          </div>
          @if (match().percentage !== null) {
            <div class="form-text">
              Tens {{ match().matched.length }} de
              {{ competencyIds().length }} no perfil ({{
                match().percentage
              }}%).
            </div>
          }
        </div>

        <div class="row g-3">
          <div class="col-sm-4">
            <label for="workMode" class="form-label">Modalidade</label>
            <select
              id="workMode"
              class="form-select"
              formControlName="workMode"
            >
              @for (w of workModes; track w) {
                <option [value]="w">{{ workModeLabels[w] }}</option>
              }
            </select>
          </div>
          <div class="col-sm-4">
            <label for="location" class="form-label">Localização</label>
            <input
              id="location"
              class="form-control"
              formControlName="location"
              placeholder="Ex.: Porto"
            />
          </div>
          <div class="col-sm-4">
            <label for="appliedAt" class="form-label"
              >Data da candidatura</label
            >
            <input
              id="appliedAt"
              type="date"
              class="form-control"
              formControlName="appliedAt"
              [max]="today"
            />
            <ds-field-error [control]="form.controls.appliedAt" />
          </div>
        </div>

        <div>
          <label for="jobUrl" class="form-label">Link do anúncio</label>
          <input
            id="jobUrl"
            type="url"
            class="form-control"
            formControlName="jobUrl"
            placeholder="https://…"
          />
          <ds-field-error
            [control]="form.controls.jobUrl"
            [messages]="{ pattern: 'Começa por http:// ou https://.' }"
          />
        </div>

        <div>
          <label for="notes" class="form-label">Notas</label>
          <textarea
            id="notes"
            class="form-control"
            rows="3"
            formControlName="notes"
            placeholder="Contactos, salário referido, impressões…"
          ></textarea>
        </div>
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
          {{ application ? 'Guardar alterações' : 'Adicionar ao quadro' }}
        </button>
      </div>
    </form>
  `,
})
export class ApplicationFormModal {
  protected readonly modal = inject(NgbActiveModal);
  protected readonly catalog = inject(CatalogApiService);
  protected readonly profile = inject(ProfileStore);
  private readonly store = inject(ApplicationsStore);
  private readonly fb = inject(FormBuilder).nonNullable;

  application: JobApplication | null = null;

  protected readonly today = today();
  protected readonly seniorities = SENIORITIES;
  protected readonly seniorityLabels = SENIORITY_LABELS;
  protected readonly workModes = WORK_MODES;
  protected readonly workModeLabels = WORK_MODE_LABELS;

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly analysisNote = signal<string | null>(null);
  private readonly searchInput =
    viewChild.required<ElementRef<HTMLInputElement>>('competencySearch');

  protected readonly form = this.fb.group({
    companyName: [
      '',
      [
        Validators.required,
        Validators.maxLength(APPLICATION_LIMITS.companyName),
      ],
    ],
    jobTitle: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(APPLICATION_LIMITS.jobTitle),
      ],
    ],
    seniority: ['UNKNOWN' as Seniority],
    yearsRequired: [
      null as number | null,
      [Validators.min(0), Validators.max(30)],
    ],
    requiredCompetencyIds: [[] as string[]],
    workMode: ['REMOTE' as WorkMode],
    location: ['', Validators.maxLength(APPLICATION_LIMITS.location)],
    appliedAt: [today(), Validators.required],
    jobUrl: [
      '',
      [
        Validators.maxLength(APPLICATION_LIMITS.url),
        Validators.pattern(URL_PATTERN),
      ],
    ],
    notes: ['', Validators.maxLength(APPLICATION_LIMITS.notes)],
  });

  protected readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  protected readonly competencyIds = computed(
    () => this.value().requiredCompetencyIds ?? [],
  );
  /** Mesma função que o servidor usa: o que aqui se vê é o que fica guardado. */
  protected readonly verdict = computed(() =>
    classifyAccessibility({
      yearsRequired: numberOrNull(this.value().yearsRequired),
      seniority: this.value().seniority ?? 'UNKNOWN',
    }),
  );
  protected readonly match = computed(() =>
    matchWithProfile(this.competencyIds(), this.profile.declaredIds()),
  );

  init(application: JobApplication | null): void {
    this.application = application;
    if (application) {
      this.form.reset({
        companyName: application.companyName,
        jobTitle: application.jobTitle,
        seniority: application.seniority,
        yearsRequired: application.yearsRequired,
        requiredCompetencyIds: [...application.requiredCompetencyIds],
        workMode: application.workMode,
        location: application.location ?? '',
        appliedAt: application.appliedAt,
        jobUrl: application.jobUrl ?? '',
        notes: application.notes ?? '',
      });
    }
  }

  analyze(text: string): void {
    if (!text.trim()) {
      this.analysisNote.set('Cola primeiro o texto do anúncio.');
      return;
    }
    const r = analyzeJobPosting(
      { title: this.form.controls.jobTitle.value, text },
      this.catalog.competencies(),
    );
    const merged = [...new Set([...this.competencyIds(), ...r.competencyIds])];
    this.form.patchValue({
      seniority: r.seniority,
      yearsRequired: r.yearsRequired,
      requiredCompetencyIds: merged.slice(0, APPLICATION_LIMITS.competencies),
    });
    const found = r.competencyIds.length;
    this.analysisNote.set(
      `${found} ${found === 1 ? 'competência encontrada' : 'competências encontradas'}` +
        (r.yearsRequired !== null ? ` · ${r.yearsRequired} anos pedidos` : '') +
        '. Confirma e ajusta se for preciso.',
    );
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
    if (ids.includes(c.id) || ids.length >= APPLICATION_LIMITS.competencies)
      return;
    this.form.controls.requiredCompetencyIds.setValue([...ids, c.id]);
    queueMicrotask(() => (this.searchInput().nativeElement.value = ''));
  }

  removeCompetency(id: string): void {
    this.form.controls.requiredCompetencyIds.setValue(
      this.competencyIds().filter((x) => x !== id),
    );
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body: SaveApplicationRequest = {
      ...v,
      yearsRequired: numberOrNull(v.yearsRequired),
    };
    this.saving.set(true);
    this.error.set(null);
    const req = this.application
      ? this.store.update(this.application.id, body)
      : this.store.create(body);
    req.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => this.modal.close(saved),
      error: (e: ApiError) => this.error.set(e.message),
    });
  }
}

/** Um <input type="number"> vazio pode chegar como null, "" ou NaN. */
function numberOrNull(v: unknown): number | null {
  return v === null || v === undefined || v === '' || Number.isNaN(Number(v))
    ? null
    : Number(v);
}
