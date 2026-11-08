import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { weekStart } from '@devstart/shared-types';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApplicationsStore } from '../../data/applications-store';

const KEY = 'devstart.weekGoal.celebratedOn';
const COLORS = [
  '#0d6efd',
  '#198754',
  '#ffc107',
  '#dc3545',
  '#6f42c1',
  '#20c997',
];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sem armazenamento (ex.: janela privada): vale só nesta visita.
  }
}

/** Confetes com posições fixas: o mesmo desenho em cada visita, sem aleatório. */
const PIECES = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 7) % 10) / 10,
  color: COLORS[i % COLORS.length],
  turn: i % 2 ? 1 : -1,
}));

/**
 * Celebração do objetivo da semana (3 candidaturas por dia útil). Aparece
 * uma vez por semana: ao cumprir o objetivo ou na primeira visita depois
 * disso, até a pessoa a fechar. Quem prefere menos movimento vê só o cartão.
 */
@Component({
  selector: 'ds-week-celebration',
  imports: [RouterLink],
  template: `
    @if (visible(); as g) {
      <section
        class="celebration card border-0 shadow-sm position-relative overflow-hidden"
        role="status"
        aria-live="polite"
      >
        <div class="confetti" aria-hidden="true">
          @for (p of pieces; track $index) {
            <i
              [style.left.%]="p.left"
              [style.background]="p.color"
              [style.animation-delay.s]="p.delay"
              [style.--turn]="p.turn"
            ></i>
          }
        </div>
        <div class="card-body d-flex gap-3 align-items-center py-3 px-4">
          <span class="fs-1 lh-1" aria-hidden="true">🎉</span>
          <div class="flex-grow-1">
            <h2 class="h5 mb-1">Objetivo da semana cumprido!</h2>
            <p class="mb-0">
              {{ g.count }} candidaturas esta semana (o objetivo era
              {{ g.target }}). Passo a passo, até ao primeiro sim!
            </p>
            @if (showLink()) {
              <a routerLink="/progress" class="small"
                >Ver o relatório da semana</a
              >
            }
          </div>
          <button
            type="button"
            class="btn-close align-self-start"
            aria-label="Fechar a celebração"
            (click)="close()"
          ></button>
        </div>
      </section>
    }
  `,
  styles: `
    .celebration {
      background: var(--bs-success-bg-subtle);
    }
    .confetti {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .confetti i {
      position: absolute;
      top: -12px;
      width: 8px;
      height: 12px;
      border-radius: 2px;
      opacity: 0;
      animation: fall 2.6s ease-in 1 forwards;
    }
    @keyframes fall {
      0% {
        opacity: 1;
        transform: translateY(0) rotate(0);
      }
      85% {
        opacity: 1;
      }
      100% {
        opacity: 0;
        transform: translateY(140px) rotate(calc(var(--turn) * 540deg));
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .confetti {
        display: none;
      }
    }
  `,
})
export class WeekCelebration {
  private readonly store = inject(ApplicationsStore);
  private readonly auth = inject(AuthService);

  /** Ligação para o relatório (no quadro sim; no próprio relatório não). */
  readonly showLink = input(false);

  protected readonly pieces = PIECES;
  private readonly closedOn = signal<string | null>(null);

  private readonly key = computed(() => `${KEY}.${this.auth.user()?.id ?? ''}`);
  private readonly monday = computed(() => weekStart(this.store.today()));

  protected readonly visible = computed(() => {
    const g = this.store.dailyGoal()?.weekGoal;
    if (!g?.done) return null;
    // Fechada nesta visita (closedOn) ou numa anterior (armazenamento).
    const closed =
      this.closedOn() === this.key() + this.monday() ||
      read(this.key()) === this.monday();
    return closed ? null : g;
  });

  constructor() {
    this.store.load();
  }

  protected close(): void {
    write(this.key(), this.monday());
    this.closedOn.set(this.key() + this.monday());
  }
}
