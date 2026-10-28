import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  LEVELS,
  LEVEL_LABELS,
  Level,
  StackMatch,
  calculateSkillGap,
} from '@devstart/shared-types';
import { startWith } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { CatalogApiService } from '../../../../core/catalog/catalog-api.service';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { GapResult } from '../../components/gap-result/gap-result';

type Mode = 'profile' | 'simulation';

/**
 * Diagnóstico de skill gap (Módulo 1).
 * - Com sessão: usa as competências e os projetos guardados no perfil.
 * - Sem sessão (ou em "Simular"): o utilizador preenche à mão.
 * Em ambos, o cálculo corre no browser com a MESMA função do backend
 * (@devstart/shared-types), por isso o resultado atualiza de imediato.
 */
@Component({
  selector: 'ds-skill-gap-page',
  imports: [ReactiveFormsModule, RouterLink, GapResult, EmptyState],
  templateUrl: './skill-gap-page.html',
})
export class SkillGapPage {
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly catalog = inject(CatalogApiService);
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(ProfileStore);

  protected readonly levels = LEVELS;
  protected readonly levelLabel = LEVEL_LABELS;

  private readonly chosenMode = signal<Mode | null>(null);
  /** Com sessão, o modo por omissão é o perfil real. */
  protected readonly mode = computed<Mode>(
    () =>
      this.chosenMode() ??
      (this.auth.isAuthenticated() ? 'profile' : 'simulation'),
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
    this.catalog.stacks().find((s) => s.id === this.formValue().stackId),
  );

  /** Entrada do cálculo, conforme o modo: perfil guardado ou formulário. */
  private readonly input = computed(() => {
    if (this.mode() === 'profile') return this.store.gapInput();
    const skills = (this.formValue().skills ?? []).filter(
      (s) => !!s.competencyId,
    );
    return {
      competencies: skills.map((s) => ({
        competencyId: s.competencyId!,
        level: s.level!,
      })),
      withProjects: new Set(
        skills.filter((s) => s.hasProject).map((s) => s.competencyId!),
      ),
    };
  });

  protected readonly result = computed(() => {
    const stack = this.selectedStack();
    if (!stack) return null;
    const { competencies, withProjects } = this.input();
    return calculateSkillGap(stack, competencies, withProjects);
  });

  /** Compatibilidade com cada stack, da mais próxima para a mais distante. */
  protected readonly ranking = computed<StackMatch[]>(() => {
    const { competencies, withProjects } = this.input();
    return this.catalog
      .stacks()
      .map((stack) => {
        const r = calculateSkillGap(stack, competencies, withProjects);
        return {
          stackId: stack.id,
          title: stack.title,
          matchPercentage: r.matchPercentage,
          missingCount: r.missing.length + r.belowLevel.length,
        };
      })
      .sort((a, b) => b.matchPercentage - a.matchPercentage);
  });

  protected readonly profileIsEmpty = computed(
    () => this.store.loaded() && this.store.competencies().length === 0,
  );

  constructor() {
    // Ao entrar em modo perfil, carrega os dados (uma vez por sessão).
    effect(() => {
      if (this.mode() === 'profile') this.store.load();
    });
    // No modo perfil, abre já a stack mais próxima, para a página nunca começar vazia.
    effect(() => {
      const best = this.ranking()[0];
      if (
        this.mode() === 'profile' &&
        best &&
        !this.form.controls.stackId.value &&
        this.store.competencies().length
      ) {
        this.form.controls.stackId.setValue(best.stackId);
      }
    });
  }

  setMode(mode: Mode): void {
    this.chosenMode.set(mode);
  }

  selectStack(stackId: string): void {
    this.form.controls.stackId.setValue(stackId);
  }

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
}
