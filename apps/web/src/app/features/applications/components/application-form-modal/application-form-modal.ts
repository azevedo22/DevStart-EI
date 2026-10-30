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
  JOB_POSTING_LIMITS,
  JobPostingDraft,
  JobApplication,
  SENIORITIES,
  SENIORITY_LABELS,
  SaveApplicationRequest,
  Seniority,
  WORK_MODES,
  WORK_MODE_LABELS,
  WorkMode,
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
import { JobPostingApi } from '../../data/job-posting-api';
import { AccessibilityBadge } from '../accessibility-badge/accessibility-badge';

const URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Criar ou editar uma candidatura. O texto do anúncio pode ser lido por IA,
 * que preenche empresa, título, senioridade, experiência e competências.
 */
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

        <details class="border rounded-3 p-3" [open]="!application">
          <summary class="fw-medium">
            <i class="bi bi-stars me-1 text-primary"></i>Analisar o anúncio
            <span class="small text-body-secondary fw-normal"
              >(opcional: a IA preenche os campos abaixo)</span
            >
          </summary>
          <textarea
            class="form-control mt-2"
            rows="6"
            aria-label="Texto do anúncio"
            placeholder="Cola aqui o anúncio completo: empresa, título, requisitos, anos de experiência, tecnologias…"
            [value]="postingText()"
            (input)="postingText.set($any($event.target).value)"
            [maxLength]="postingLimits.maxText"
          ></textarea>
          @if (reader(); as r) {
            <p class="small text-body-secondary mt-1 mb-0">
              @if (r.externalProvider) {
                <i class="bi bi-cloud-arrow-up me-1"></i>O texto é enviado para
                a <strong>{{ r.externalProvider }}</strong> ({{ r.label }}) para
                ser lido. Não fica guardado.
              } @else {
                <i class="bi bi-shield-lock me-1"></i>Lido por uma IA no teu
                computador ({{ r.label }}).
              }
            </p>
          }
          <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
            <button
              type="button"
              class="btn btn-sm btn-primary"
              [disabled]="analyzing()"
              (click)="analyze()"
            >
              @if (analyzing()) {
                <span
                  class="spinner-border spinner-border-sm me-1"
                  aria-hidden="true"
                ></span>
                A analisar…
              } @else {
                <i class="bi bi-stars me-1"></i>Analisar
              }
            </button>
            @if (analysis(); as a) {
              <span
                class="small"
                [class.text-success]="a.ok"
                [class.text-warning-emphasis]="!a.ok"
                role="status"
              >
                <i
                  class="bi me-1"
                  [class.bi-check-circle]="a.ok"
                  [class.bi-exclamation-triangle]="!a.ok"
                ></i
                >{{ a.text }}
              </span>
            }
          </div>
          @if (otherSkills().length) {
            <p class="small text-body-secondary mt-2 mb-0">
              Também pede (fora do catálogo): {{ otherSkills().join(', ') }}.
            </p>
          }
        </details>

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

        <div>
          <label for="experienceInput" class="form-label"
            >Experiência pedida</label
          >
          @if (experience().length) {
            <ul class="list-group mb-2">
              @for (e of experience(); track $index) {
                <li
                  class="list-group-item d-flex align-items-center gap-2 py-1 small"
                >
                  <span class="me-auto">{{ e }}</span>
                  <button
                    type="button"
                    class="btn-close"
                    style="font-size: 0.6rem"
                    [attr.aria-label]="'Remover ' + e"
                    (click)="removeExperience($index)"
                  ></button>
                </li>
              }
            </ul>
          }
          @if (experience().length < limits.experienceItems) {
            <div class="input-group input-group-sm">
              <input
                #experienceInput
                id="experienceInput"
                class="form-control"
                placeholder="Ex.: 1 ano a desenvolver APIs REST"
                [maxLength]="limits.experienceItem"
                (keydown.enter)="
                  addExperience(experienceInput); $event.preventDefault()
                "
              />
              <button
                type="button"
                class="btn btn-outline-secondary"
                (click)="addExperience(experienceInput)"
              >
                Adicionar
              </button>
            </div>
          }
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
  private readonly jobs = inject(JobPostingApi);
  private readonly fb = inject(FormBuilder).nonNullable;

  application: JobApplication | null = null;

  protected readonly today = today();
  protected readonly seniorities = SENIORITIES;
  protected readonly seniorityLabels = SENIORITY_LABELS;
  protected readonly workModes = WORK_MODES;
  protected readonly workModeLabels = WORK_MODE_LABELS;

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly limits = APPLICATION_LIMITS;
  protected readonly postingLimits = JOB_POSTING_LIMITS;
  protected readonly postingText = signal('');
  protected readonly analyzing = signal(false);
  /** Resultado da última análise: ok = a IA leu; senão, aviso. */
  protected readonly analysis = signal<{ ok: boolean; text: string } | null>(
    null,
  );
  protected readonly otherSkills = signal<string[]>([]);
  /** Que IA lê o anúncio (a mesma que lê os CVs), para o aviso. */
  protected readonly reader = toSignal(this.profile.cvReader$, {
    initialValue: null,
  });
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
    experienceRequirements: [[] as string[]],
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
  protected readonly experience = computed(
    () => this.value().experienceRequirements ?? [],
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
        experienceRequirements: [...(application.experienceRequirements ?? [])],
        workMode: application.workMode,
        location: application.location ?? '',
        appliedAt: application.appliedAt,
        jobUrl: application.jobUrl ?? '',
        notes: application.notes ?? '',
      });
    }
  }

  analyze(): void {
    const text = this.postingText().trim();
    if (text.length < JOB_POSTING_LIMITS.minText) {
      this.analysis.set({
        ok: false,
        text: 'Cola primeiro o texto completo do anúncio.',
      });
      return;
    }
    this.analyzing.set(true);
    this.analysis.set(null);
    this.jobs
      .analyze(text)
      .pipe(finalize(() => this.analyzing.set(false)))
      .subscribe({
        next: (draft) => this.apply(draft),
        error: (e: ApiError) =>
          this.analysis.set({ ok: false, text: e.message }),
      });
  }

  /**
   * Preenche o formulário com o que a análise encontrou. Só muda os campos
   * para os quais há resposta; competências e experiência juntam-se às que lá
   * estavam. Nada é gravado até carregar em guardar.
   */
  private apply(d: JobPostingDraft): void {
    const filled: string[] = [];
    const patch: Partial<ReturnType<typeof this.form.getRawValue>> = {};
    if (d.companyName) {
      patch.companyName = d.companyName;
      filled.push('empresa');
    }
    if (d.jobTitle) {
      patch.jobTitle = d.jobTitle;
      filled.push('título');
    }
    if (d.seniority !== 'UNKNOWN') {
      patch.seniority = d.seniority;
      filled.push('senioridade');
    }
    if (d.yearsRequired !== null) {
      patch.yearsRequired = d.yearsRequired;
      filled.push('anos');
    }
    if (d.experienceRequirements.length) {
      patch.experienceRequirements = mergeUnique(
        this.experience(),
        d.experienceRequirements,
      ).slice(0, APPLICATION_LIMITS.experienceItems);
      filled.push('experiência');
    }
    if (d.competencyIds.length) {
      patch.requiredCompetencyIds = [
        ...new Set([...this.competencyIds(), ...d.competencyIds]),
      ].slice(0, APPLICATION_LIMITS.competencies);
      filled.push(
        `${d.competencyIds.length} ${d.competencyIds.length === 1 ? 'competência' : 'competências'}`,
      );
    }
    if (d.workMode) patch.workMode = d.workMode;
    if (d.location) patch.location = d.location;
    this.form.patchValue(patch);
    this.otherSkills.set(d.otherSkills);

    if (d.source === 'ai') {
      this.analysis.set({
        ok: true,
        text: filled.length
          ? `Preenchido: ${filled.join(', ')}. Confirma e ajusta se for preciso.`
          : 'A IA não encontrou dados neste texto. Confirma se é o anúncio certo.',
      });
    } else {
      this.analysis.set({
        ok: false,
        text: d.warnings[0] ?? 'Analisado sem IA, só por palavras-chave.',
      });
    }
  }

  addExperience(input: HTMLInputElement): void {
    const value = input.value.replace(/\s+/g, ' ').trim();
    if (!value) return;
    this.form.controls.experienceRequirements.setValue(
      mergeUnique(this.experience(), [value]).slice(
        0,
        APPLICATION_LIMITS.experienceItems,
      ),
    );
    input.value = '';
  }

  removeExperience(index: number): void {
    this.form.controls.experienceRequirements.setValue(
      this.experience().filter((_, i) => i !== index),
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

/** Junta listas de texto sem repetir (ignora maiúsculas). */
function mergeUnique(current: string[], extra: string[]): string[] {
  const seen = new Set(current.map((x) => x.toLowerCase()));
  const out = [...current];
  for (const x of extra) {
    if (seen.has(x.toLowerCase())) continue;
    seen.add(x.toLowerCase());
    out.push(x);
  }
  return out;
}

/** Um <input type="number"> vazio pode chegar como null, "" ou NaN. */
function numberOrNull(v: unknown): number | null {
  return v === null || v === undefined || v === '' || Number.isNaN(Number(v))
    ? null
    : Number(v);
}
