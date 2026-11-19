import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { JourneyStats } from '@devstart/shared-types';
import { API_BASE_URL } from '../../../../core/config/api.config';
import { daysBetween, plural } from './journey-card.util';

/**
 * "O teu caminho até ao primeiro sim": uma curiosidade em "A minha conta".
 * Os números só aumentam (apagar uma candidatura não os baixa) e o primeiro
 * sim, a primeira proposta, fica gravado com os números desse dia.
 */
@Component({
  selector: 'ds-journey-card',
  imports: [DatePipe],
  template: `
    @if (stats(); as s) {
      <section class="card border-0 shadow-sm mb-4">
        <div class="card-body p-4">
          <h2 class="h6 text-body-secondary text-uppercase small mb-3">
            <i class="bi bi-flag me-1" aria-hidden="true"></i>O teu caminho até
            ao primeiro sim
          </h2>

          @if (s.firstYes; as y) {
            <div
              class="alert alert-success d-flex gap-3 align-items-center mb-3"
            >
              <i class="bi bi-trophy fs-3" aria-hidden="true"></i>
              <div>
                <div class="fw-semibold">
                  Primeiro sim a {{ y.on | date: 'longDate' }}:
                  {{ y.companyName }}
                </div>
                <div class="small">
                  {{ plural(y.applications, 'candidatura', 'candidaturas') }}
                  · {{ plural(y.interviews, 'entrevista', 'entrevistas') }} ·
                  {{ plural(y.days, 'dia', 'dias') }}
                </div>
              </div>
            </div>
          }

          @if (s.applicationsSent) {
            <div class="row g-3 text-center">
              <div class="col-4">
                <div class="fs-3 fw-semibold">{{ s.applicationsSent }}</div>
                <div class="small text-body-secondary">
                  {{
                    s.applicationsSent === 1
                      ? 'candidatura enviada'
                      : 'candidaturas enviadas'
                  }}
                </div>
              </div>
              <div class="col-4">
                <div class="fs-3 fw-semibold">{{ s.interviews }}</div>
                <div class="small text-body-secondary">
                  {{ s.interviews === 1 ? 'entrevista' : 'entrevistas' }}
                </div>
              </div>
              <div class="col-4">
                <div class="fs-3 fw-semibold">{{ days() }}</div>
                <div class="small text-body-secondary">
                  {{ days() === 1 ? 'dia' : 'dias' }} desde a primeira
                </div>
              </div>
            </div>
            <p class="small text-body-secondary mb-0 mt-3">
              Estes números só aumentam: apagar uma candidatura não os baixa.
              @if (s.firstAppliedOn) {
                A primeira foi a {{ s.firstAppliedOn | date: 'longDate' }}.
              }
            </p>
          } @else {
            <p class="text-body-secondary mb-0">
              Ainda não enviaste nenhuma candidatura. O caminho começa na
              primeira.
            </p>
          }
        </div>
      </section>
    }
  `,
})
export class JourneyCard {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  protected readonly stats = signal<JourneyStats | null>(null);
  protected readonly plural = plural;

  protected readonly days = computed(() => {
    const first = this.stats()?.firstAppliedOn;
    return first
      ? daysBetween(first, new Date().toLocaleDateString('sv-SE'))
      : 0;
  });

  constructor() {
    // Se falhar, a secção simplesmente não aparece: é só uma curiosidade.
    this.http
      .get<JourneyStats>(`${this.api}/applications/journey`)
      .subscribe({ next: (s) => this.stats.set(s), error: () => undefined });
  }
}
