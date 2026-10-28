import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GapItem, LEVEL_LABELS, SkillGapResult } from '@devstart/shared-types';
import { NgbProgressbar } from '@ng-bootstrap/ng-bootstrap';
import { CatalogApiService } from '../../../../core/catalog/catalog-api.service';

interface GapGroup {
  key: keyof Pick<
    SkillGapResult,
    'coveredWithProjects' | 'coveredWithoutProjects' | 'belowLevel' | 'missing'
  >;
  title: string;
  hint: string;
  icon: string;
  tone: string;
}

@Component({
  selector: 'ds-gap-result',
  imports: [NgbProgressbar, RouterLink],
  template: `
    @let r = result();
    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-baseline mb-2">
          <h2 class="h6 mb-0 text-body-secondary">
            Compatibilidade com a stack
          </h2>
          <span class="fs-3 fw-semibold">{{ r.matchPercentage }}%</span>
        </div>
        <ngb-progressbar
          [type]="tone()"
          [value]="r.matchPercentage"
          height="0.6rem"
        />
      </div>
    </div>

    @for (group of groups; track group.key) {
      @if (r[group.key].length) {
        <section class="mt-4">
          <h3 class="h6 d-flex align-items-center gap-2">
            <i class="bi {{ group.icon }} text-{{ group.tone }}"></i
            >{{ group.title }}
            <span class="badge rounded-pill text-bg-light">{{
              r[group.key].length
            }}</span>
          </h3>
          <p class="small text-body-secondary mb-2">
            {{ group.hint }}
            @if (linkToProfile() && group.key === 'coveredWithoutProjects') {
              <a routerLink="/profile">Associar a um projeto</a>
            }
          </p>
          <ul class="list-group">
            @for (item of r[group.key]; track item.competencyId) {
              <li
                class="list-group-item d-flex justify-content-between align-items-center"
              >
                <span>{{ catalog.nameOf(item.competencyId) }}</span>
                <span class="small text-body-secondary">{{
                  levelText(item)
                }}</span>
              </li>
            }
          </ul>
        </section>
      }
    }
  `,
})
export class GapResult {
  protected readonly catalog = inject(CatalogApiService);

  readonly result = input.required<SkillGapResult>();
  /** Com perfil guardado, as recomendações levam à página de perfil. */
  readonly linkToProfile = input(false);

  protected readonly groups: GapGroup[] = [
    {
      key: 'missing',
      title: 'Falta aprender',
      hint: 'Ordenado por importância para a stack.',
      icon: 'bi-x-circle',
      tone: 'danger',
    },
    {
      key: 'belowLevel',
      title: 'Abaixo do nível pedido',
      hint: 'Já começaste — falta aprofundar.',
      icon: 'bi-arrow-up-circle',
      tone: 'warning',
    },
    {
      key: 'coveredWithoutProjects',
      title: 'Sabes, mas falta um projeto',
      hint: 'O caminho mais rápido para reforçar o portfólio.',
      icon: 'bi-folder-plus',
      tone: 'info',
    },
    {
      key: 'coveredWithProjects',
      title: 'Pronto a mostrar',
      hint: 'Competências com projeto associado.',
      icon: 'bi-check-circle',
      tone: 'success',
    },
  ];

  protected readonly tone = computed(() => {
    const p = this.result().matchPercentage;
    return p >= 75 ? 'success' : p >= 40 ? 'warning' : 'danger';
  });

  protected levelText(item: GapItem): string {
    const required = LEVEL_LABELS[item.requiredLevel];
    return item.currentLevel
      ? `${LEVEL_LABELS[item.currentLevel]} / pede ${required}`
      : `pede ${required}`;
  }
}
