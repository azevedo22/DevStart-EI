import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  ApplicationExportItem,
  DevToolsStatus,
  JobListingText,
  matchWithProfile,
} from '@devstart/shared-types';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';

/**
 * Ferramenta de desenvolvimento: exporta as candidaturas com o que a IA leu e
 * o texto do anúncio, para os casos de avaliação. Só existe com DEV_TOOLS=true
 * no servidor; sem isso, as rotas respondem 404 e o botão não aparece.
 */
@Injectable({ providedIn: 'root' })
export class ExportApplicationsApi {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);

  status(): Observable<DevToolsStatus> {
    return this.http.get<DevToolsStatus>(`${this.api}/applications/dev-tools`);
  }

  applications(): Observable<ApplicationExportItem[]> {
    return this.http.get<ApplicationExportItem[]>(
      `${this.api}/applications/export`,
    );
  }

  /** Textos das vagas que vieram da página Vagas, procurados pelo link. */
  listingTexts(urls: string[]): Observable<JobListingText[]> {
    return this.http.post<JobListingText[]>(`${this.api}/jobs/feed/texts`, {
      urls,
    });
  }
}

/** De onde veio o texto do anúncio de cada candidatura. */
export type PostingSource = 'analisado' | 'vagas' | null;

export interface ExportedApplication {
  empresa: string;
  vaga: string;
  link: string | null;
  coluna: string;
  candidatura: string;
  modalidade: string;
  local: string | null;
  senioridade: string;
  anosPedidos: number | null;
  acessibilidade: string;
  competencias: string[];
  foraDoCatalogo: string[];
  experienciaPedida: string[];
  compatibilidade: {
    percentagem: number | null;
    tens: string[];
    faltam: string[];
  };
  /** O texto que a IA leu. null nas candidaturas antigas criadas à mão. */
  anuncio: string | null;
  origemDoAnuncio: PostingSource;
  /** Só nas vagas da página Vagas: se a IA já as tinha lido, e quando. */
  leituraDaVaga?: { fonte: string; em: string | null };
}

export interface ApplicationsExport {
  exportadoEm: string;
  total: number;
  comAnuncio: number;
  semAnuncio: number;
  competenciasDoPerfil: string[];
  candidaturas: ExportedApplication[];
}

/** Os links das candidaturas sem texto guardado, para os procurar nas Vagas. */
export function urlsWithoutText(items: ApplicationExportItem[]): string[] {
  return [
    ...new Set(
      items.flatMap((a) => (!a.postingText && a.jobUrl ? [a.jobUrl] : [])),
    ),
  ];
}

/**
 * Junta as candidaturas, os textos das Vagas e o perfil num só ficheiro. A
 * compatibilidade usa a mesma conta que o quadro, para o ficheiro mostrar o
 * que a pessoa viu na app.
 */
export function buildExport(
  items: ApplicationExportItem[],
  listings: JobListingText[],
  declared: ReadonlySet<string>,
  nameOf: (id: string) => string,
  now: Date,
): ApplicationsExport {
  const byUrl = new Map(listings.map((l) => [l.url, l]));
  const candidaturas = items.map((a): ExportedApplication => {
    const listing = a.jobUrl ? byUrl.get(a.jobUrl) : undefined;
    const anuncio = a.postingText ?? listing?.body ?? null;
    const origem: PostingSource = a.postingText
      ? 'analisado'
      : listing
        ? 'vagas'
        : null;
    const m = matchWithProfile(
      a.requiredCompetencyIds,
      declared,
      a.otherSkills,
    );
    return {
      empresa: a.companyName,
      vaga: a.jobTitle,
      link: a.jobUrl,
      coluna: a.status,
      candidatura: a.appliedAt,
      modalidade: a.workMode,
      local: a.location,
      senioridade: a.seniority,
      anosPedidos: a.yearsRequired,
      acessibilidade: a.accessibility,
      competencias: a.requiredCompetencyIds.map(nameOf),
      foraDoCatalogo: a.otherSkills,
      experienciaPedida: a.experienceRequirements,
      compatibilidade: {
        percentagem: m.percentage,
        tens: m.matched.map(nameOf),
        faltam: [...m.missing.map(nameOf), ...m.outside],
      },
      anuncio,
      origemDoAnuncio: origem,
      ...(origem === 'vagas' &&
        listing && {
          leituraDaVaga: {
            fonte: listing.analysisSource,
            em: listing.analyzedAt,
          },
        }),
    };
  });
  const comAnuncio = candidaturas.filter((c) => c.anuncio).length;
  return {
    exportadoEm: now.toISOString(),
    total: candidaturas.length,
    comAnuncio,
    semAnuncio: candidaturas.length - comAnuncio,
    competenciasDoPerfil: [...declared]
      .map(nameOf)
      .sort((a, b) => a.localeCompare(b, 'pt')),
    candidaturas,
  };
}

/** Nome do ficheiro: devstart-candidaturas-AAAA-MM-DD.json (dia local). */
export function exportFileName(today: string): string {
  return `devstart-candidaturas-${today}.json`;
}
