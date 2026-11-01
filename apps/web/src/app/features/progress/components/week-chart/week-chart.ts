import { Component, computed, input, signal } from '@angular/core';
import {
  REPORT_SERIES,
  ReportSeriesId,
  WEEKDAY_SHORT,
  WeeklyReport,
} from '@devstart/shared-types';

/**
 * Cor de cada série: ordem fixa da paleta categórica (validada para
 * daltonismo). As cores estão em styles.scss, para valerem em toda a página.
 */
export const SERIES_COLORS: Record<ReportSeriesId, string> = {
  applications: 'var(--series-1)',
  positive: 'var(--series-2)',
  rejected: 'var(--series-3)',
  interviews: 'var(--series-4)',
  projects: 'var(--series-5)',
};

// Geometria do SVG (unidades do viewBox; o SVG estica para a largura).
const W = 700;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 34, left: 28 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const GROUP_W = PLOT_W / 7;
const GROUP_PAD = 14;
const GAP = 2;

interface Bar {
  id: ReportSeriesId;
  path: string;
}

/**
 * Barras agrupadas por dia (segunda a domingo), uma por série. Passar o rato
 * ou o foco num dia mostra os números desse dia; a lista por dia, por baixo,
 * é a versão em texto.
 */
@Component({
  selector: 'ds-week-chart',
  template: `
    <div class="viz-root">
      <!-- Legenda: identidade nunca só pela cor -->
      <ul class="list-inline small mb-2 d-flex flex-wrap gap-3">
        @for (s of series; track s.id) {
          <li class="d-flex align-items-center gap-1">
            <span class="swatch" [style.background]="colors[s.id]"></span>
            <span>{{ s.label }}</span>
            <span class="text-body-secondary">{{ report().series[s.id] }}</span>
          </li>
        }
      </ul>

      <div class="position-relative">
        <svg
          [attr.viewBox]="'0 0 ' + W + ' ' + H"
          class="w-100 d-block"
          role="img"
          [attr.aria-label]="ariaLabel()"
        >
          <!-- Grelha discreta -->
          @for (t of ticks(); track t) {
            <line
              [attr.x1]="PAD.left"
              [attr.x2]="W - PAD.right"
              [attr.y1]="y(t)"
              [attr.y2]="y(t)"
              class="grid"
              [class.base]="t === 0"
            />
            <text
              [attr.x]="PAD.left - 6"
              [attr.y]="y(t) + 4"
              text-anchor="end"
              class="axis"
            >
              {{ t }}
            </text>
          }

          @for (d of report().days; track d.date; let i = $index) {
            @if (hovered() === i) {
              <rect
                [attr.x]="PAD.left + i * GROUP_W + 3"
                [attr.y]="PAD.top"
                [attr.width]="GROUP_W - 6"
                [attr.height]="PLOT_H"
                rx="6"
                class="hover-band"
              />
            }
            @for (b of bars()[i]; track b.id) {
              <path [attr.d]="b.path" [attr.fill]="colors[b.id]" />
            }
            <text
              [attr.x]="PAD.left + i * GROUP_W + GROUP_W / 2"
              [attr.y]="H - 14"
              text-anchor="middle"
              class="axis"
              [class.weekend]="!d.active"
              [class.fw-semibold]="d.date === today()"
            >
              {{ weekdays[d.weekday] }} {{ +d.date.slice(8) }}
            </text>
            <!-- Área de toque maior do que as barras -->
            <rect
              [attr.x]="PAD.left + i * GROUP_W"
              [attr.y]="0"
              [attr.width]="GROUP_W"
              [attr.height]="H"
              fill="transparent"
              tabindex="0"
              class="hit"
              [attr.aria-label]="dayLabel(i)"
              (mouseenter)="hovered.set(i)"
              (mouseleave)="hovered.set(null)"
              (focus)="hovered.set(i)"
              (blur)="hovered.set(null)"
            />
          }
        </svg>

        @if (hovered() !== null) {
          @let i = hovered()!;
          @let d = report().days[i];
          <div
            class="chart-tip card shadow-sm small"
            [style.left.%]="tipLeft(i)"
            [class.flip]="i >= 4"
            role="status"
          >
            <div class="card-body py-2 px-3">
              <div class="fw-semibold mb-1">
                {{ weekdays[d.weekday] }} {{ +d.date.slice(8) }}
                @if (d.future) {
                  <span class="text-body-secondary fw-normal">· ainda não</span>
                }
              </div>
              @for (s of series; track s.id) {
                <div class="d-flex align-items-center gap-2">
                  <span class="swatch" [style.background]="colors[s.id]"></span>
                  <span class="me-auto">{{ s.label }}</span>
                  <span class="fw-semibold">{{ d.series[s.id] }}</span>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .swatch {
      display: inline-block;
      width: 0.7rem;
      height: 0.7rem;
      border-radius: 2px;
      flex-shrink: 0;
    }
    .grid {
      stroke: var(--bs-border-color-translucent);
      stroke-width: 1;
    }
    .grid.base {
      stroke: var(--bs-border-color);
    }
    .axis {
      font-size: 12px;
      fill: var(--bs-secondary-color);
    }
    /* O SVG encolhe com o ecrã: num telemóvel, o texto precisa de ser maior. */
    @media (max-width: 575.98px) {
      .axis {
        font-size: 20px;
      }
    }
    .axis.weekend {
      font-style: italic;
    }
    .axis.fw-semibold {
      fill: var(--bs-body-color);
      font-weight: 600;
    }
    .hover-band {
      fill: var(--bs-tertiary-bg);
    }
    .hit {
      outline: none;
      cursor: default;
    }
    .chart-tip.flip {
      transform: translateX(-100%);
    }
    .chart-tip {
      position: absolute;
      top: 0;
      min-width: 12rem;
      pointer-events: none;
      z-index: 2;
    }
  `,
})
export class WeekChart {
  readonly report = input.required<WeeklyReport>();
  readonly today = input<string>('');

  protected readonly W = W;
  protected readonly H = H;
  protected readonly PAD = PAD;
  protected readonly PLOT_H = PLOT_H;
  protected readonly GROUP_W = GROUP_W;
  protected readonly series = REPORT_SERIES;
  protected readonly colors = SERIES_COLORS;
  protected readonly weekdays = WEEKDAY_SHORT;
  protected readonly hovered = signal<number | null>(null);

  /** Topo da escala: pelo menos 3 (o objetivo diário), arredondado ao passo. */
  private readonly scale = computed(() => {
    const peak = Math.max(3, this.report().peak);
    const step = peak <= 6 ? 1 : peak <= 12 ? 2 : 5;
    return { max: Math.ceil(peak / step) * step, step };
  });

  protected readonly ticks = computed(() => {
    const { max, step } = this.scale();
    return Array.from({ length: max / step + 1 }, (_, i) => i * step);
  });

  protected readonly bars = computed<Bar[][]>(() => {
    const n = this.series.length;
    const barW = (GROUP_W - GROUP_PAD - GAP * (n - 1)) / n;
    return this.report().days.map((d, i) =>
      this.series
        .map((s, j) => {
          const v = d.series[s.id];
          if (!v) return null;
          const x = PAD.left + i * GROUP_W + GROUP_PAD / 2 + j * (barW + GAP);
          return { id: s.id, path: topRounded(x, this.y(v), barW, this.y(0)) };
        })
        .filter((b): b is Bar => b !== null),
    );
  });

  protected readonly ariaLabel = computed(
    () =>
      'Atividade por dia da semana: ' +
      this.report()
        .days.map((_, i) => this.dayLabel(i))
        .join('; '),
  );

  protected y(v: number): number {
    return PAD.top + PLOT_H - (v / this.scale().max) * PLOT_H;
  }

  protected dayLabel(i: number): string {
    const d = this.report().days[i];
    const parts = this.series
      .filter((s) => d.series[s.id])
      .map((s) => `${s.label} ${d.series[s.id]}`);
    return `${WEEKDAY_SHORT[d.weekday]} ${+d.date.slice(8)}: ${parts.join(', ') || 'nada'}`;
  }

  /** A caixa fica ao lado do dia, para não tapar as barras dele. */
  protected tipLeft(i: number): number {
    const edge = i >= 4 ? PAD.left + i * GROUP_W : PAD.left + (i + 1) * GROUP_W;
    return (edge / W) * 100;
  }
}

/** Barra com os cantos de cima arredondados (4px) e assente na base. */
function topRounded(x: number, top: number, w: number, base: number): string {
  const r = Math.min(4, w / 2, base - top);
  return [
    `M${x},${base}`,
    `V${top + r}`,
    `Q${x},${top} ${x + r},${top}`,
    `H${x + w - r}`,
    `Q${x + w},${top} ${x + w},${top + r}`,
    `V${base}`,
    'Z',
  ].join(' ');
}
