import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { LEVELS, Level, calculateSkillGap } from '@devstart/shared-types';
import { catchError, of, startWith } from 'rxjs';
import { ApiError } from '../../../../core/http/error.interceptor';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { GapResult } from '../../components/gap-result/gap-result';
import { CatalogApiService } from '../../services/catalog-api.service';

/**
 * Diagnóstico de skill gap (Módulo 1).
 * O catálogo vem da API; o cálculo corre no browser com a MESMA função
 * do backend (@devstart/shared-types), por isso o resultado atualiza ao escrever.
 */
@Component({
  selector: 'ds-skill-gap-page',
  imports: [ReactiveFormsModule, GapResult, EmptyState],
  templateUrl: './skill-gap-page.html',
})
export class SkillGapPage {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly catalog = inject(CatalogApiService);

  protected readonly levels = LEVELS;
  protected readonly levelLabel: Record<Level, string> = {
    BASIC: 'Básico',
    INTERMEDIATE: 'Intermédio',
    ADVANCED: 'Avançado',
  };

  protected loadError: string | null = null;
  protected readonly stacks = toSignal(
    this.catalog.stacks$.pipe(catchError((e: ApiError) => this.fail(e))),
    { initialValue: [] },
  );
  protected readonly competencies = toSignal(
    this.catalog.competencies$.pipe(catchError((e: ApiError) => this.fail(e))),
    { initialValue: [] },
  );

  protected readonly form = this.fb.group({
    stackId: ['', Validators.required],
    skills: this.fb.array([this.newSkill()]),
  });

  get skills(): FormArray {
    return this.form.controls.skills;
  }

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    {
      initialValue: this.form.getRawValue(),
    },
  );

  protected readonly selectedStack = computed(() =>
    this.stacks().find((s) => s.id === this.formValue().stackId),
  );

  protected readonly result = computed(() => {
    const stack = this.selectedStack();
    if (!stack) return null;
    const skills = (this.formValue().skills ?? []).filter(
      (s) => !!s.competencyId,
    );
    return calculateSkillGap(
      stack,
      skills.map((s) => ({ competencyId: s.competencyId!, level: s.level! })),
      new Set(skills.filter((s) => s.hasProject).map((s) => s.competencyId!)),
    );
  });

  addSkill(): void {
    this.skills.push(this.newSkill());
  }

  removeSkill(index: number): void {
    this.skills.removeAt(index);
  }

  private newSkill() {
    return this.fb.group({
      competencyId: ['', Validators.required],
      level: ['BASIC' as Level],
      hasProject: [false],
    });
  }

  private fail(e: ApiError) {
    this.loadError = e.message;
    return of([]);
  }
}
