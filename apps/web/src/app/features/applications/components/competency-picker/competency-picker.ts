import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import {
  APPLICATION_LIMITS,
  Competency,
  matchWithProfile,
} from '@devstart/shared-types';
import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { Observable, debounceTime, distinctUntilChanged, map } from 'rxjs';
import { CatalogApiService } from '../../../../core/catalog/catalog-api.service';
import { ProfileStore } from '../../../../core/profile/profile-store';

/**
 * "Competências pedidas": pesquisa no catálogo e uma pílula por competência,
 * verde quando já está no perfil. Por baixo, quantas a pessoa já tem.
 */
@Component({
  selector: 'ds-competency-picker',
  imports: [NgbTypeahead],
  template: `
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
      (selectItem)="add($event.item); $event.preventDefault()"
    />
    <div class="d-flex flex-wrap gap-2 mt-2">
      @for (id of ids(); track id) {
        @let have = profile.declaredIds().has(id);
        <span
          class="badge rounded-pill fw-normal d-inline-flex align-items-center gap-1"
          [class.text-bg-success]="have"
          [class.text-bg-light]="!have"
          [class.border]="!have"
          [title]="have ? 'Está no teu perfil' : 'Ainda não está no teu perfil'"
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
            (click)="remove(id)"
          ></button>
        </span>
      }
    </div>
    <div class="mt-3">
      <label for="otherSkill" class="form-label small mb-1"
        >Também pede (fora do catálogo)</label
      >
      <div class="d-flex flex-wrap gap-2 mb-2">
        @for (o of others(); track o) {
          <span
            class="badge rounded-pill fw-normal text-bg-light border d-inline-flex align-items-center gap-1"
            style="border-style: dashed !important"
            title="Não existe no catálogo: conta como em falta"
          >
            {{ o }}
            <button
              type="button"
              class="btn-close ms-1"
              style="font-size: 0.55rem"
              [attr.aria-label]="'Remover ' + o"
              (click)="removeOther(o)"
            ></button>
          </span>
        }
      </div>
      @if (others().length < limits.otherSkills) {
        <input
          #otherSkill
          id="otherSkill"
          type="text"
          class="form-control form-control-sm"
          placeholder="Ex.: C/C++, microcontroladores… (Enter para acrescentar)"
          [maxLength]="limits.otherSkill"
          (keydown.enter)="
            addOther(otherSkill.value);
            otherSkill.value = '';
            $event.preventDefault()
          "
        />
      }
    </div>
    @if (match().percentage !== null) {
      <div class="form-text">
        Tens {{ match().matched.length }} de {{ total() }} no perfil ({{
          match().percentage
        }}%).
        @if (others().length) {
          As de fora do catálogo contam como em falta.
        }
      </div>
    }
  `,
})
export class CompetencyPicker {
  protected readonly catalog = inject(CatalogApiService);
  protected readonly profile = inject(ProfileStore);

  readonly ids = input.required<string[]>();
  readonly idsChange = output<string[]>();
  /** O que a vaga pede e não existe no catálogo. */
  readonly others = input<string[]>([]);
  readonly othersChange = output<string[]>();
  protected readonly limits = APPLICATION_LIMITS;

  private readonly searchInput =
    viewChild.required<ElementRef<HTMLInputElement>>('competencySearch');

  protected readonly match = computed(() =>
    matchWithProfile(this.ids(), this.profile.declaredIds(), this.others()),
  );
  protected readonly total = computed(
    () => this.ids().length + this.others().length,
  );

  protected addOther(raw: string): void {
    const v = raw.trim();
    if (!v) return;
    const lower = v.toLowerCase();
    if (this.others().some((o) => o.toLowerCase() === lower)) return;
    this.othersChange.emit([...this.others(), v]);
  }

  protected removeOther(v: string): void {
    this.othersChange.emit(this.others().filter((o) => o !== v));
  }

  protected readonly suggest = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(150),
      distinctUntilChanged(),
      map((term) => this.catalog.search(term, new Set(this.ids()))),
    );
  protected readonly nameFormatter = (c: Competency) => c.name;
  protected readonly emptyFormatter = () => '';

  protected add(c: Competency): void {
    const ids = this.ids();
    if (ids.includes(c.id) || ids.length >= APPLICATION_LIMITS.competencies)
      return;
    this.idsChange.emit([...ids, c.id]);
    queueMicrotask(() => (this.searchInput().nativeElement.value = ''));
  }

  protected remove(id: string): void {
    this.idsChange.emit(this.ids().filter((x) => x !== id));
  }
}
