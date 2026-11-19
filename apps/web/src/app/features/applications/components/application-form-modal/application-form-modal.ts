import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  APPLICATION_LIMITS,
  ApplicationKind,
  JobPostingDraft,
  JobApplication,
  SENIORITIES,
  SENIORITY_LABELS,
  SPONTANEOUS_CHANNELS,
  SPONTANEOUS_CHANNEL_LABELS,
  SaveApplicationRequest,
  Seniority,
  SpontaneousChannel,
  WORK_MODES,
  WORK_MODE_LABELS,
  WorkMode,
  classifyAccessibility,
} from '@devstart/shared-types';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../core/http/error.interceptor';
import { FieldError } from '../../../../shared/forms/field-error';
import { ApplicationsStore } from '../../data/applications-store';
import { AccessibilityBadge } from '../accessibility-badge/accessibility-badge';
import { CompetencyPicker } from '../competency-picker/competency-picker';
import { ExperienceListEditor } from '../experience-list-editor/experience-list-editor';
import { JobPostingAnalyzer } from '../job-posting-analyzer/job-posting-analyzer';
import { draftPatch, numberOrNull } from './application-form.util';

const URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Criar ou editar uma candidatura. O texto do anúncio pode ser lido por IA
 * (JobPostingAnalyzer), que preenche empresa, título, senioridade, experiência
 * e competências; a experiência e as competências têm editores próprios.
 * Aqui ficam o formulário, a acessibilidade calculada e o guardar.
 */
@Component({
  selector: 'ds-application-form-modal',
  imports: [
    ReactiveFormsModule,
    FieldError,
    AccessibilityBadge,
    JobPostingAnalyzer,
    ExperienceListEditor,
    CompetencyPicker,
  ],
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

        @if (!application) {
          <div
            class="btn-group w-100"
            role="group"
            aria-label="Tipo de candidatura"
          >
            <input
              type="radio"
              class="btn-check"
              id="kind-job"
              name="kind"
              [checked]="kind() === 'JOB'"
              (change)="setKind('JOB')"
            />
            <label class="btn btn-outline-primary" for="kind-job"
              ><i class="bi bi-file-earmark-text me-1"></i>A uma vaga</label
            >
            <input
              type="radio"
              class="btn-check"
              id="kind-spontaneous"
              name="kind"
              [checked]="kind() === 'SPONTANEOUS'"
              (change)="setKind('SPONTANEOUS')"
            />
            <label class="btn btn-outline-primary" for="kind-spontaneous"
              ><i class="bi bi-send me-1"></i>Espontânea</label
            >
          </div>
        }

        @if (spontaneous()) {
          <p class="small text-body-secondary mb-0">
            Enviaste o CV a uma empresa sem vaga aberta. Sem anúncio, não há
            competências nem percentagem; se não responderem num mês, a app
            lembra-te de reenviar.
          </p>
        } @else {
          <ds-job-posting-analyzer
            [open]="!application"
            (analyzed)="applyDraft($event)"
            (analyzedText)="postingText = $event"
          />
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
            <label for="jobTitle" class="form-label">{{
              spontaneous() ? 'Área ou função (opcional)' : 'Título da vaga'
            }}</label>
            <input
              id="jobTitle"
              class="form-control"
              formControlName="jobTitle"
              [placeholder]="
                spontaneous()
                  ? 'Ex.: IA e dados'
                  : 'Ex.: Junior Frontend Developer'
              "
            />
            <ds-field-error [control]="form.controls.jobTitle" />
          </div>
        </div>

        @if (spontaneous()) {
          <div class="row g-3">
            <div class="col-sm-6">
              <label for="channel" class="form-label">Enviada por</label>
              <select
                id="channel"
                class="form-select"
                formControlName="channel"
              >
                <option value="">Não indicado</option>
                @for (c of channels; track c) {
                  <option [value]="c">{{ channelLabels[c] }}</option>
                }
              </select>
            </div>
            <div class="col-sm-6">
              <label for="contact" class="form-label"
                >Contacto (opcional)</label
              >
              <input
                id="contact"
                class="form-control"
                formControlName="contact"
                placeholder="Nome ou e-mail de quem recebeu"
              />
              <ds-field-error [control]="form.controls.contact" />
            </div>
          </div>
        }

        @if (!spontaneous()) {
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
            <ds-experience-list-editor
              [items]="experience()"
              (itemsChange)="
                form.controls.experienceRequirements.setValue($event)
              "
            />
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
            <ds-competency-picker
              [ids]="competencyIds()"
              (idsChange)="form.controls.requiredCompetencyIds.setValue($event)"
              [others]="otherSkills()"
              (othersChange)="form.controls.otherSkills.setValue($event)"
            />
          </div>
        }

        <div class="row g-3">
          @if (!spontaneous()) {
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
          }
          <div [class]="spontaneous() ? 'col-sm-6' : 'col-sm-4'">
            <label for="location" class="form-label">Localização</label>
            <input
              id="location"
              class="form-control"
              formControlName="location"
              placeholder="Ex.: Porto"
            />
          </div>
          <div [class]="spontaneous() ? 'col-sm-6' : 'col-sm-4'">
            <label for="appliedAt" class="form-label">{{
              spontaneous() ? 'Data do envio' : 'Data da candidatura'
            }}</label>
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
          <label for="jobUrl" class="form-label">{{
            spontaneous()
              ? 'Link (página de carreiras, opcional)'
              : 'Link do anúncio'
          }}</label>
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
  private readonly store = inject(ApplicationsStore);
  private readonly fb = inject(FormBuilder).nonNullable;

  application: JobApplication | null = null;

  protected readonly today = today();
  protected readonly seniorities = SENIORITIES;
  protected readonly seniorityLabels = SENIORITY_LABELS;
  protected readonly workModes = WORK_MODES;
  protected readonly workModeLabels = WORK_MODE_LABELS;
  protected readonly channels = SPONTANEOUS_CHANNELS;
  protected readonly channelLabels = SPONTANEOUS_CHANNEL_LABELS;

  /** Vaga ou espontânea: escolhe-se ao criar e não muda depois. */
  protected readonly kind = signal<ApplicationKind>('JOB');
  protected readonly spontaneous = computed(
    () => this.kind() === 'SPONTANEOUS',
  );

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

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
    otherSkills: [[] as string[]],
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
    channel: ['' as SpontaneousChannel | ''],
    contact: ['', Validators.maxLength(APPLICATION_LIMITS.contact)],
  });

  /** O título só é obrigatório nas vagas; na espontânea é a área, opcional. */
  protected setKind(kind: ApplicationKind): void {
    this.kind.set(kind);
    const title = this.form.controls.jobTitle;
    title.setValidators(
      kind === 'JOB'
        ? [
            Validators.required,
            Validators.minLength(2),
            Validators.maxLength(APPLICATION_LIMITS.jobTitle),
          ]
        : [Validators.maxLength(APPLICATION_LIMITS.jobTitle)],
    );
    title.updateValueAndValidity();
  }

  protected readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  protected readonly competencyIds = computed(
    () => this.value().requiredCompetencyIds ?? [],
  );
  protected readonly experience = computed(
    () => this.value().experienceRequirements ?? [],
  );
  protected readonly otherSkills = computed(
    () => this.value().otherSkills ?? [],
  );
  /** Mesma função que o servidor usa: o que aqui se vê é o que fica guardado. */
  protected readonly verdict = computed(() =>
    classifyAccessibility({
      yearsRequired: numberOrNull(this.value().yearsRequired),
      seniority: this.value().seniority ?? 'UNKNOWN',
    }),
  );

  init(application: JobApplication | null): void {
    this.application = application;
    if (application) {
      this.setKind(application.kind ?? 'JOB');
      this.form.reset({
        companyName: application.companyName,
        jobTitle: application.jobTitle,
        seniority: application.seniority,
        yearsRequired: application.yearsRequired,
        requiredCompetencyIds: [...application.requiredCompetencyIds],
        otherSkills: [...(application.otherSkills ?? [])],
        experienceRequirements: [...(application.experienceRequirements ?? [])],
        workMode: application.workMode,
        location: application.location ?? '',
        appliedAt: application.appliedAt,
        jobUrl: application.jobUrl ?? '',
        notes: application.notes ?? '',
        channel: application.channel ?? '',
        contact: application.contact ?? '',
      });
    }
  }

  /**
   * Preenche o formulário com o que a análise encontrou. Só muda os campos
   * para os quais há resposta; nada é gravado até carregar em guardar.
   */
  protected applyDraft(d: JobPostingDraft): void {
    this.form.patchValue(
      draftPatch(d, {
        experience: this.experience(),
        competencyIds: this.competencyIds(),
        otherSkills: this.otherSkills(),
      }),
    );
  }

  /**
   * O texto do último anúncio analisado. Vai com a candidatura para se poder
   * voltar a medir a leitura da IA; sem nova análise, o que estava fica.
   */
  protected postingText: string | undefined;

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const { channel, contact, ...job } = v;
    const body: SaveApplicationRequest = this.spontaneous()
      ? {
          kind: 'SPONTANEOUS',
          companyName: v.companyName,
          jobTitle: v.jobTitle,
          location: v.location,
          appliedAt: v.appliedAt,
          jobUrl: v.jobUrl,
          notes: v.notes,
          channel: channel || null,
          contact: contact || null,
        }
      : {
          ...job,
          kind: 'JOB',
          yearsRequired: numberOrNull(v.yearsRequired),
          ...(this.postingText !== undefined && {
            postingText: this.postingText.slice(
              0,
              APPLICATION_LIMITS.postingText,
            ),
          }),
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
