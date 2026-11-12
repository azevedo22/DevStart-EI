import { Component, inject, signal } from '@angular/core';
import { finalize, map, of, switchMap } from 'rxjs';
import { CatalogApiService } from '../../../../core/catalog/catalog-api.service';
import { ApiError } from '../../../../core/http/error.interceptor';
import { ProfileStore } from '../../../../core/profile/profile-store';
import {
  ExportApplicationsApi,
  buildExport,
  exportFileName,
  urlsWithoutText,
} from '../../data/export-applications';

/**
 * Ferramenta de desenvolvimento, no fim do perfil: descarrega um ficheiro com
 * as candidaturas, o que a IA leu e o texto do anúncio, para os casos de
 * avaliação. Só aparece com DEV_TOOLS=true no servidor.
 */
@Component({
  selector: 'ds-export-applications',
  template: `
    @if (enabled()) {
      <section class="card border-dashed shadow-sm">
        <div
          class="card-body d-flex flex-wrap align-items-center gap-3 py-3 px-4"
        >
          <i
            class="bi bi-tools fs-4 text-body-secondary"
            aria-hidden="true"
          ></i>
          <div class="me-auto">
            <h2 class="h6 mb-1">
              Exportar candidaturas
              <span class="badge text-bg-secondary ms-1">Developer</span>
            </h2>
            <p class="small text-body-secondary mb-0">
              Um ficheiro com cada candidatura feita, o que a IA leu do anúncio,
              a compatibilidade com o teu perfil e o texto do anúncio, para
              avaliar a leitura da IA.
            </p>
            @if (result(); as r) {
              <p
                class="small mb-0 mt-1"
                [class.text-danger]="!r.ok"
                role="status"
              >
                {{ r.text }}
              </p>
            }
          </div>
          <button
            type="button"
            class="btn btn-outline-secondary"
            [disabled]="busy()"
            (click)="export()"
          >
            @if (busy()) {
              <span
                class="spinner-border spinner-border-sm me-1"
                aria-hidden="true"
              ></span>
            } @else {
              <i class="bi bi-download me-1" aria-hidden="true"></i>
            }
            Exportar candidaturas
          </button>
        </div>
      </section>
    }
  `,
  styles: `
    .border-dashed {
      border: 1px dashed var(--bs-border-color) !important;
    }
  `,
})
export class ExportApplications {
  private readonly api = inject(ExportApplicationsApi);
  private readonly profile = inject(ProfileStore);
  private readonly catalog = inject(CatalogApiService);

  protected readonly enabled = signal(false);
  protected readonly busy = signal(false);
  protected readonly result = signal<{ ok: boolean; text: string } | null>(
    null,
  );

  constructor() {
    // Sem DEV_TOOLS (ou sem resposta), o botão simplesmente não aparece.
    this.api.status().subscribe({
      next: (s) => this.enabled.set(s.export),
      error: () => this.enabled.set(false),
    });
  }

  protected export(): void {
    this.busy.set(true);
    this.result.set(null);
    this.api
      .applications()
      .pipe(
        switchMap((items) => {
          const urls = urlsWithoutText(items);
          const texts$ = urls.length ? this.api.listingTexts(urls) : of([]);
          return texts$.pipe(map((texts) => ({ items, texts })));
        }),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: ({ items, texts }) => {
          const data = buildExport(
            items,
            texts,
            this.profile.declaredIds(),
            (id) => this.catalog.nameOf(id),
            new Date(),
          );
          download(
            exportFileName(new Date().toLocaleDateString('sv-SE')),
            JSON.stringify(data, null, 2),
          );
          this.result.set({
            ok: true,
            text: `Exportadas ${data.total} candidaturas: ${data.comAnuncio} com o texto do anúncio, ${data.semAnuncio} só com o link.`,
          });
        },
        error: (e: ApiError) =>
          this.result.set({
            ok: false,
            text: e.message || 'Não foi possível exportar.',
          }),
      });
  }
}

function download(name: string, content: string): void {
  const url = URL.createObjectURL(
    new Blob([content], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
