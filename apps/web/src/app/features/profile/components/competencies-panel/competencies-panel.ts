import {
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CATEGORY_LABELS,
  Competency,
  CompetencyCategory,
  LEVELS,
  LEVEL_LABELS,
  Level,
  ProfileCompetency,
} from '@devstart/shared-types';
import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { Observable, debounceTime, distinctUntilChanged, map } from 'rxjs';
import { CatalogApiService } from '../../../../core/catalog/catalog-api.service';
import { ApiError } from '../../../../core/http/error.interceptor';
import { ProfileStore } from '../../../../core/profile/profile-store';

interface CategoryGroup {
  category: CompetencyCategory;
  label: string;
  items: ProfileCompetency[];
}

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as CompetencyCategory[];

/**
 * Competências declaradas, agrupadas por categoria.
 * Cada linha mostra se já há um projeto que a demonstre: é aqui que o utilizador
 * percebe onde o portfólio está fraco.
 */
@Component({
  selector: 'ds-competencies-panel',
  imports: [FormsModule, NgbTypeahead],
  template: `
    <section class="card border-0 shadow-sm h-100">
      <div class="card-body p-4">
        <div class="d-flex justify-content-between align-items-baseline mb-1">
          <h2 class="h5 mb-0">Competências</h2>
          <span class="small text-body-secondary"
            >{{ store.competencies().length }} declaradas</span
          >
        </div>
        <p class="small text-body-secondary">
          Indica o que dominas. O nível é a tua avaliação honesta.
        </p>

        <div class="row g-2 align-items-center mb-3">
          <div class="col-12 col-sm">
            <input
              #search
              type="search"
              class="form-control"
              placeholder="Procurar competência…"
              title="Pesquisa por nome ou termo, ex.: Angular, Jest, Docker"
              aria-label="Procurar competência"
              [ngbTypeahead]="suggest"
              [resultTemplate]="result"
              [inputFormatter]="formatName"
              [editable]="false"
              (selectItem)="selected.set($event.item)"
              (input)="selected.set(null)"
            />
            <ng-template #result let-r="result">
              <div class="d-flex justify-content-between gap-3">
                <span>{{ r.name }}</span
                ><span class="small opacity-75">{{ categoryLabel(r) }}</span>
              </div>
            </ng-template>
          </div>
          <div class="col-8 col-sm-auto">
            <select
              class="form-select"
              [(ngModel)]="newLevel"
              aria-label="Nível"
            >
              @for (level of levels; track level) {
                <option [value]="level">{{ levelLabels[level] }}</option>
              }
            </select>
          </div>
          <div class="col-4 col-sm-auto">
            <button
              type="button"
              class="btn btn-primary w-100"
              [disabled]="!selected() || busy()"
              (click)="add()"
            >
              Adicionar
            </button>
          </div>
        </div>

        @if (error(); as e) {
          <div class="alert alert-danger py-2">{{ e }}</div>
        }

        @if (!groups().length) {
          <p class="text-body-secondary text-center py-4 mb-0">
            <i class="bi bi-stars d-block fs-3 mb-2"></i>Começa pela linguagem
            que mais usaste no curso.
          </p>
        }

        @for (group of groups(); track group.category) {
          <h3 class="h6 text-uppercase small text-body-secondary mt-3 mb-2">
            {{ group.label }}
          </h3>
          <ul class="list-group">
            @for (c of group.items; track c.competencyId) {
              @let count = projectCount(c.competencyId);
              <li class="list-group-item d-flex align-items-center gap-2">
                <div class="flex-grow-1 min-w-0">
                  <div class="fw-medium text-truncate">
                    {{ catalog.nameOf(c.competencyId) }}
                  </div>
                  @if (count) {
                    <span
                      class="badge text-bg-success-subtle text-success-emphasis fw-normal"
                      title="Projetos que demonstram esta competência"
                    >
                      <i class="bi bi-check2-circle me-1"></i>{{ count }}
                      {{ count === 1 ? 'projeto' : 'projetos' }}
                    </span>
                  } @else {
                    <span
                      class="badge text-bg-warning-subtle text-warning-emphasis fw-normal"
                      title="Associa-a a um projeto para a poderes mostrar"
                    >
                      <i class="bi bi-folder-plus me-1"></i>sem projeto
                    </span>
                  }
                </div>
                <select
                  class="form-select form-select-sm w-auto flex-shrink-0"
                  [ngModel]="c.level"
                  (ngModelChange)="changeLevel(c.competencyId, $event)"
                  [attr.aria-label]="
                    'Nível de ' + catalog.nameOf(c.competencyId)
                  "
                >
                  @for (level of levels; track level) {
                    <option [value]="level">{{ levelLabels[level] }}</option>
                  }
                </select>
                <button
                  type="button"
                  class="btn btn-sm btn-link text-danger p-0 flex-shrink-0"
                  (click)="remove(c.competencyId)"
                  [attr.aria-label]="
                    'Remover ' + catalog.nameOf(c.competencyId)
                  "
                >
                  <i class="bi bi-x-lg"></i>
                </button>
              </li>
            }
          </ul>
        }
      </div>
    </section>
  `,
  styles: `
    .min-w-0 {
      min-width: 0;
    }
  `,
})
export class CompetenciesPanel {
  protected readonly store = inject(ProfileStore);
  protected readonly catalog = inject(CatalogApiService);

  protected readonly levels = LEVELS;
  protected readonly levelLabels = LEVEL_LABELS;

  protected newLevel: Level = 'BASIC';
  protected readonly selected = signal<Competency | null>(null);
  private readonly searchInput =
    viewChild.required<ElementRef<HTMLInputElement>>('search');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly groups = computed<CategoryGroup[]>(() => {
    const byCategory = new Map<CompetencyCategory, ProfileCompetency[]>();
    for (const c of this.store.competencies()) {
      const category = this.catalog.competency(c.competencyId)?.category;
      if (!category) continue;
      byCategory.set(category, [...(byCategory.get(category) ?? []), c]);
    }
    return CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat],
      items: byCategory
        .get(cat)!
        .sort((a, b) =>
          this.catalog
            .nameOf(a.competencyId)
            .localeCompare(this.catalog.nameOf(b.competencyId)),
        ),
    }));
  });

  /** Sugestões do catálogo, sem as já declaradas. */
  protected readonly suggest = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(150),
      distinctUntilChanged(),
      map((term) => this.catalog.search(term, this.store.declaredIds())),
    );

  protected readonly formatName = (c: Competency) => c.name;

  protected categoryLabel(c: Competency): string {
    return CATEGORY_LABELS[c.category];
  }

  protected projectCount(id: string): number {
    return this.store.projectCountByCompetency().get(id) ?? 0;
  }

  add(): void {
    const c = this.selected();
    if (!c) return;
    this.run(this.store.declareCompetency(c.id, this.newLevel), () => {
      this.selected.set(null);
      this.searchInput().nativeElement.value = ''; // pronto para a próxima
      this.searchInput().nativeElement.focus();
    });
  }

  changeLevel(id: string, level: Level): void {
    this.run(this.store.declareCompetency(id, level));
  }

  remove(id: string): void {
    this.run(this.store.removeCompetency(id));
  }

  private run(op: Observable<unknown>, done?: () => void): void {
    this.busy.set(true);
    this.error.set(null);
    op.subscribe({
      next: () => done?.(),
      error: (e: ApiError) => {
        this.error.set(e.message);
        this.busy.set(false);
      },
      complete: () => this.busy.set(false),
    });
  }
}
