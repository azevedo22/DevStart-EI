import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CvDraft,
  CvProfileFields,
  EXPERIENCE_KIND_LABELS,
  ImportCvRequest,
  LANGUAGE_LEVELS,
  LANGUAGE_LEVEL_LABELS,
  LEVELS,
  LEVEL_LABELS,
  LanguageLevel,
  Level,
  ORIGIN_LABELS,
  Profile,
  Project,
  SaveEducationRequest,
  SaveExperienceRequest,
  SaveProjectRequest,
} from '@devstart/shared-types';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { finalize } from 'rxjs';
import { CatalogApiService } from '../../../../core/catalog/catalog-api.service';
import { ApiError } from '../../../../core/http/error.interceptor';
import { ProfileStore } from '../../../../core/profile/profile-store';

type FieldKey = keyof CvProfileFields;

const FIELD_LABELS: Record<FieldKey, string> = {
  headline: 'Título profissional',
  location: 'Localização',
  university: 'Instituição',
  graduationYear: 'Ano de conclusão',
  bio: 'Apresentação',
  linkedinUrl: 'LinkedIn',
  githubUrl: 'GitHub',
  portfolioUrl: 'Portefólio',
};

interface Row<T> {
  value: T;
  selected: boolean;
  /** Já existe no perfil (fica desmarcado; o servidor também não o duplicaria). */
  existing: boolean;
}

interface FieldRow {
  key: FieldKey;
  label: string;
  value: string;
  current: string | null;
  selected: boolean;
}

const LEVEL_RANK: Record<Level, number> = {
  BASIC: 0,
  INTERMEDIATE: 1,
  ADVANCED: 2,
};
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Revisão do que a IA leu do CV. Nada é gravado até o utilizador confirmar.
 * Por omissão vem tudo marcado, exceto o que já está no perfil: a importação
 * nunca substitui dados do utilizador sem ele escolher.
 */
@Component({
  selector: 'ds-cv-review-modal',
  imports: [FormsModule],
  template: `
    <div class="modal-header">
      <div>
        <h2 class="modal-title h5 mb-0">Rever o que foi lido do CV</h2>
        <div class="small text-body-secondary">
          Escolhe o que entra no teu perfil. Podes corrigir o texto aqui ou
          editar tudo mais tarde.
        </div>
      </div>
      <button
        type="button"
        class="btn-close"
        aria-label="Fechar"
        (click)="modal.dismiss()"
      ></button>
    </div>

    <div class="modal-body vstack gap-4">
      @for (w of draft.warnings; track w) {
        <div class="alert alert-warning py-2 mb-0 small">
          <i class="bi bi-exclamation-triangle me-1"></i>{{ w }}
        </div>
      }

      @if (fields.length) {
        <section>
          <h3 class="h6">Dados do perfil</h3>
          <div class="vstack gap-2">
            @for (f of fields; track f.key) {
              <div class="d-flex gap-2 align-items-start">
                <input
                  class="form-check-input mt-2 flex-shrink-0"
                  type="checkbox"
                  [(ngModel)]="f.selected"
                  [id]="'f-' + f.key"
                  [attr.aria-label]="'Importar ' + f.label"
                />
                <div class="flex-grow-1">
                  <label class="form-label small mb-1" [for]="'v-' + f.key">{{
                    f.label
                  }}</label>
                  @if (f.key === 'bio') {
                    <textarea
                      class="form-control form-control-sm"
                      rows="3"
                      [id]="'v-' + f.key"
                      [(ngModel)]="f.value"
                      [disabled]="!f.selected"
                    ></textarea>
                  } @else {
                    <input
                      class="form-control form-control-sm"
                      [id]="'v-' + f.key"
                      [(ngModel)]="f.value"
                      [disabled]="!f.selected"
                    />
                  }
                  @if (f.current) {
                    <div class="form-text">
                      No perfil: <em>{{ f.current }}</em>
                      @if (f.selected) {
                        <span class="text-warning-emphasis">
                          · vai ser substituído</span
                        >
                      }
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </section>
      }

      @if (competencies.length) {
        <section>
          <div class="d-flex justify-content-between align-items-baseline">
            <h3 class="h6">Competências ({{ competencies.length }})</h3>
            <button
              type="button"
              class="btn btn-link btn-sm p-0"
              (click)="toggleAll(competencies)"
            >
              {{
                allSelected(competencies) ? 'Desmarcar todas' : 'Marcar todas'
              }}
            </button>
          </div>
          <p class="small text-body-secondary mb-2">
            O nível é uma sugestão a partir do CV: ajusta ao que achas que
            sabes.
          </p>
          <div class="row g-2">
            @for (c of competencies; track c.value.competencyId) {
              <div class="col-md-6">
                <div
                  class="d-flex align-items-center gap-2 border rounded-2 px-2 py-1"
                  [class.opacity-50]="!c.selected"
                >
                  <input
                    class="form-check-input flex-shrink-0 m-0"
                    type="checkbox"
                    [(ngModel)]="c.selected"
                    [attr.aria-label]="catalog.nameOf(c.value.competencyId)"
                  />
                  <div class="flex-grow-1 small text-truncate">
                    <span class="fw-medium">{{
                      catalog.nameOf(c.value.competencyId)
                    }}</span>
                    @if (
                      c.value.evidence.toLowerCase() !==
                      catalog.nameOf(c.value.competencyId).toLowerCase()
                    ) {
                      <span
                        class="text-body-secondary"
                        [title]="'Encontrado em: ' + c.value.evidence"
                      >
                        · {{ c.value.evidence }}</span
                      >
                    }
                    @if (c.existing) {
                      <span class="text-body-secondary"> · já no perfil</span>
                    }
                  </div>
                  <select
                    class="form-select form-select-sm w-auto"
                    [(ngModel)]="c.value.level"
                    [disabled]="!c.selected"
                    [attr.aria-label]="
                      'Nível de ' + catalog.nameOf(c.value.competencyId)
                    "
                  >
                    @for (l of levels; track l) {
                      <option [value]="l">{{ levelLabels[l] }}</option>
                    }
                  </select>
                </div>
              </div>
            }
          </div>
          @if (draft.unmatchedSkills.length) {
            <p class="small text-body-secondary mt-2 mb-0">
              <i class="bi bi-info-circle me-1"></i>Não estão no catálogo e
              ficam de fora: {{ draft.unmatchedSkills.join(', ') }}.
            </p>
          }
        </section>
      }

      @if (education.length) {
        <section>
          <h3 class="h6">Formação</h3>
          <div class="vstack gap-2">
            @for (e of education; track $index) {
              <label
                class="d-flex gap-2 border rounded-2 p-2 small"
                [class.opacity-50]="!e.selected"
              >
                <input
                  class="form-check-input flex-shrink-0 mt-1"
                  type="checkbox"
                  [(ngModel)]="e.selected"
                />
                <span>
                  <span class="fw-medium">{{ e.value.degree }}</span
                  ><br />
                  {{ e.value.institution }}
                  <span class="text-body-secondary">{{ years(e.value) }}</span>
                  @if (e.existing) {
                    <span class="text-body-secondary"> · já no perfil</span>
                  }
                </span>
              </label>
            }
          </div>
        </section>
      }

      @if (experience.length) {
        <section>
          <h3 class="h6">Experiência</h3>
          <div class="vstack gap-2">
            @for (e of experience; track $index) {
              <label
                class="d-flex gap-2 border rounded-2 p-2 small"
                [class.opacity-50]="!e.selected"
              >
                <input
                  class="form-check-input flex-shrink-0 mt-1"
                  type="checkbox"
                  [(ngModel)]="e.selected"
                />
                <span>
                  <span class="fw-medium">{{ e.value.role }}</span> ·
                  {{ e.value.organization }}
                  <span class="badge text-bg-light fw-normal ms-1">{{
                    kindLabels[e.value.kind]
                  }}</span
                  ><br />
                  <span class="text-body-secondary">{{ period(e.value) }}</span>
                  @if (e.value.description) {
                    <span class="d-block text-body-secondary">{{
                      e.value.description
                    }}</span>
                  }
                  @if (e.existing) {
                    <span class="text-body-secondary">Já no perfil.</span>
                  }
                </span>
              </label>
            }
          </div>
        </section>
      }

      @if (languages.length) {
        <section>
          <h3 class="h6">Línguas</h3>
          <div class="d-flex flex-wrap gap-2">
            @for (l of languages; track l.value.language) {
              <div
                class="d-flex align-items-center gap-2 border rounded-2 px-2 py-1"
                [class.opacity-50]="!l.selected"
              >
                <input
                  class="form-check-input m-0"
                  type="checkbox"
                  [(ngModel)]="l.selected"
                  [attr.aria-label]="l.value.language"
                />
                <span class="small fw-medium">{{ l.value.language }}</span>
                <select
                  class="form-select form-select-sm w-auto"
                  [(ngModel)]="l.value.level"
                  [disabled]="!l.selected"
                  [attr.aria-label]="'Nível de ' + l.value.language"
                >
                  @for (lv of languageLevels; track lv) {
                    <option [value]="lv">{{ languageLevelLabels[lv] }}</option>
                  }
                </select>
              </div>
            }
          </div>
        </section>
      }

      @if (projects.length) {
        <section>
          <h3 class="h6">Projetos</h3>
          <div class="vstack gap-2">
            @for (p of projects; track $index) {
              <label
                class="d-flex gap-2 border rounded-2 p-2 small"
                [class.opacity-50]="!p.selected"
              >
                <input
                  class="form-check-input flex-shrink-0 mt-1"
                  type="checkbox"
                  [(ngModel)]="p.selected"
                />
                <span>
                  <span class="fw-medium">{{ p.value.title }}</span>
                  <span class="badge text-bg-light fw-normal ms-1">{{
                    originLabels[p.value.origin]
                  }}</span
                  ><br />
                  <span class="text-body-secondary">{{
                    p.value.description
                  }}</span>
                  @if (p.value.competencyIds.length) {
                    <span class="d-block mt-1">
                      @for (id of p.value.competencyIds; track id) {
                        <span
                          class="badge rounded-pill text-bg-primary fw-normal me-1"
                          >{{ catalog.nameOf(id) }}</span
                        >
                      }
                    </span>
                  }
                  @if (p.existing) {
                    <span class="text-body-secondary"
                      >Já existe um projeto com este nome.</span
                    >
                  }
                </span>
              </label>
            }
          </div>
        </section>
      }

      @if (nothingFound) {
        <p class="text-body-secondary mb-0">
          Não encontrei nada para importar neste CV.
        </p>
      }
    </div>

    <div class="modal-footer">
      @if (error(); as e) {
        <div class="text-danger small me-auto" role="alert">{{ e }}</div>
      }
      <button type="button" class="btn btn-light" (click)="modal.dismiss()">
        Cancelar
      </button>
      <button
        type="button"
        class="btn btn-primary"
        [disabled]="!selectedCount() || saving()"
        (click)="import()"
      >
        @if (saving()) {
          <span
            class="spinner-border spinner-border-sm me-2"
            aria-hidden="true"
          ></span>
        }
        Importar {{ selectedCount() }}
        {{ selectedCount() === 1 ? 'item' : 'itens' }}
      </button>
    </div>
  `,
})
export class CvReviewModal {
  protected readonly modal = inject(NgbActiveModal);
  protected readonly catalog = inject(CatalogApiService);
  private readonly store = inject(ProfileStore);

  protected readonly levels = LEVELS;
  protected readonly levelLabels = LEVEL_LABELS;
  protected readonly languageLevels = LANGUAGE_LEVELS;
  protected readonly languageLevelLabels = LANGUAGE_LEVEL_LABELS;
  protected readonly kindLabels = EXPERIENCE_KIND_LABELS;
  protected readonly originLabels = ORIGIN_LABELS;

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected draft!: CvDraft;
  protected fields: FieldRow[] = [];
  protected competencies: Row<{
    competencyId: string;
    level: Level;
    evidence: string;
  }>[] = [];
  protected education: Row<SaveEducationRequest>[] = [];
  protected experience: Row<SaveExperienceRequest>[] = [];
  protected languages: Row<{ language: string; level: LanguageLevel }>[] = [];
  protected projects: Row<SaveProjectRequest>[] = [];

  /** Chamado por quem abre o modal. */
  init(draft: CvDraft, profile: Profile | null, projects: Project[]): void {
    this.draft = draft;

    this.fields = (Object.keys(FIELD_LABELS) as FieldKey[])
      .filter((key) => draft.fields[key] !== null && draft.fields[key] !== '')
      .map((key) => {
        const current = profile?.[key] ?? null;
        const value = String(draft.fields[key]);
        return {
          key,
          label: FIELD_LABELS[key],
          value,
          current:
            current !== null && String(current) !== value
              ? String(current)
              : null,
          // Só vem marcado se o campo estiver vazio no perfil.
          selected: current === null || current === '',
        };
      });

    const declared = new Map(
      (profile?.competencies ?? []).map((c) => [c.competencyId, c.level]),
    );
    this.competencies = draft.competencies.map((c) => {
      const current = declared.get(c.competencyId);
      return {
        value: { ...c },
        existing: !!current,
        // Já declarada com nível igual ou superior: nada a ganhar.
        selected: !current || LEVEL_RANK[c.level] > LEVEL_RANK[current],
      };
    });

    const eduKeys = new Set(
      (profile?.education ?? []).map(
        (e) => `${norm(e.institution)}|${norm(e.degree)}`,
      ),
    );
    this.education = draft.education.map((e) => {
      const existing = eduKeys.has(`${norm(e.institution)}|${norm(e.degree)}`);
      return { value: e, existing, selected: !existing };
    });

    const expKeys = new Set(
      (profile?.experience ?? []).map(
        (e) => `${norm(e.organization)}|${norm(e.role)}|${e.startDate ?? ''}`,
      ),
    );
    this.experience = draft.experience.map((e) => {
      const existing = expKeys.has(
        `${norm(e.organization)}|${norm(e.role)}|${e.startDate ?? ''}`,
      );
      return { value: e, existing, selected: !existing };
    });

    const langs = new Map(
      (profile?.languages ?? []).map((l) => [norm(l.language), l.level]),
    );
    this.languages = draft.languages.map((l) => {
      const current = langs.get(norm(l.language));
      return {
        value: { ...l },
        existing: !!current,
        selected: current !== l.level,
      };
    });

    const titles = new Set(projects.map((p) => norm(p.title)));
    this.projects = draft.projects.map((p) => {
      const existing = titles.has(norm(p.title));
      return { value: p, existing, selected: !existing };
    });
  }

  protected get nothingFound(): boolean {
    return (
      !this.fields.length &&
      !this.competencies.length &&
      !this.education.length &&
      !this.experience.length &&
      !this.languages.length &&
      !this.projects.length
    );
  }

  protected selectedCount(): number {
    const count = (rows: { selected: boolean }[]) =>
      rows.filter((r) => r.selected).length;
    return (
      count(this.fields) +
      count(this.competencies) +
      count(this.education) +
      count(this.experience) +
      count(this.languages) +
      count(this.projects)
    );
  }

  protected allSelected(rows: { selected: boolean }[]): boolean {
    return rows.every((r) => r.selected);
  }

  protected toggleAll(rows: { selected: boolean }[]): void {
    const value = !this.allSelected(rows);
    rows.forEach((r) => (r.selected = value));
  }

  protected years(e: SaveEducationRequest): string {
    if (!e.startYear && !e.endYear) return '';
    return ` · ${e.startYear ?? '?'} – ${e.endYear ?? 'atual'}`;
  }

  protected period(e: SaveExperienceRequest): string {
    const fmt = (d: string | null) =>
      d ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : null;
    const start = fmt(e.startDate);
    const end = fmt(e.endDate) ?? 'atual';
    return start ? `${start} – ${end}` : '';
  }

  import(): void {
    const picked = <T>(rows: Row<T>[]) =>
      rows.filter((r) => r.selected).map((r) => r.value);

    const fields: Partial<CvProfileFields> = {};
    for (const f of this.fields.filter((f) => f.selected)) {
      const v = f.value.trim();
      (fields as Record<string, unknown>)[f.key] =
        f.key === 'graduationYear' ? (v ? Number(v) : null) : v || null;
    }

    const req: ImportCvRequest = {
      fields,
      competencies: picked(this.competencies).map(
        ({ competencyId, level }) => ({
          competencyId,
          level,
        }),
      ),
      education: picked(this.education),
      experience: picked(this.experience),
      languages: picked(this.languages),
      projects: picked(this.projects),
    };

    this.saving.set(true);
    this.error.set(null);
    this.store
      .importCv(req)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.modal.close(this.selectedCount()),
        error: (e: ApiError) => this.error.set(e.message),
      });
  }
}
