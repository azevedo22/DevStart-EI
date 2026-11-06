import {
  Accessibility,
  JOB_FEED_LIMITS,
  JobFeedItem,
  JobFeedQuery,
  JobFeedResponse,
  JobListing,
  Seniority,
  WorkMode,
  matchWithProfile,
} from '@devstart/shared-types';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CatalogService } from '../catalog/catalog.service';
import { JobSyncService } from './job-sync.service';

interface Row {
  id: string;
  title: string;
  company_name: string;
  company_logo: string | null;
  url: string;
  locations: string[];
  location_ids: number[];
  work_mode: WorkMode | null;
  contract_ids: number[];
  summary: string;
  published_at: Date;
  first_seen_at: Date;
  seniority: Seniority;
  years_required: number | null;
  accessibility: Accessibility;
  mislabeled_junior: boolean;
  competency_ids: string[];
  experience_requirements: string[];
  other_skills: string[];
  analysis_source: 'ai' | 'keywords';
}

/**
 * As vagas abertas vistas por um utilizador: filtradas, comparadas com as
 * competências do perfil e ordenadas. "Novas" são as que apareceram depois
 * da última visita à secção.
 */
@Injectable()
export class JobFeedService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly catalog: CatalogService,
    private readonly sync: JobSyncService,
  ) {}

  async feed(userId: string, q: JobFeedQuery): Promise<JobFeedResponse> {
    const visit = await this.visit(userId);
    const stack = q.stackId ? this.catalog.findStack(q.stackId) : null;
    const stackIds = new Set(stack?.requirements.map((r) => r.competencyId));

    const rows: Row[] = await this.db.query(
      ...this.filtered(q, stack ? [...stackIds] : null),
    );
    const declared = await this.declared(userId);

    const items = rows.map((r): JobFeedItem & { stackOverlap: number } => {
      const m = matchWithProfile(r.competency_ids, declared, r.other_skills);
      return {
        ...toListing(r),
        matched: m.matched,
        missing: m.missing,
        outside: m.outside,
        matchPercentage: m.percentage,
        isNew: !!visit && r.first_seen_at > visit.lastVisitAt,
        stackOverlap: r.competency_ids.filter((id) => stackIds.has(id)).length,
      };
    });

    // Stack escolhida: primeiro as que mais pedem dela. Depois, a
    // compatibilidade com o perfil, e por fim as mais recentes.
    items.sort(
      (a, b) =>
        b.stackOverlap - a.stackOverlap ||
        (b.matchPercentage ?? -1) - (a.matchPercentage ?? -1) ||
        b.publishedAt.localeCompare(a.publishedAt),
    );

    const [{ open }] = await this.db.query(
      `SELECT count(*)::int AS open FROM job_listings WHERE closed_at IS NULL`,
    );
    const lastSync = await this.sync.lastSyncAt();
    return {
      items: items
        .slice(0, JOB_FEED_LIMITS.maxItems)
        .map(({ stackOverlap: _, ...item }) => item),
      totalOpen: open,
      enabled: this.sync.enabled,
      lastSyncAt: lastSync?.toISOString() ?? null,
    };
  }

  /** Vagas novas desde a última visita, com os filtros dessa visita. */
  async newCount(userId: string): Promise<number> {
    const visit = await this.visit(userId);
    if (!visit) return 0;
    const stack =
      visit.query.stackId && this.stackExists(visit.query.stackId)
        ? this.catalog.findStack(visit.query.stackId)
        : null;
    const [sql, params] = this.filtered(
      visit.query,
      stack ? stack.requirements.map((r) => r.competencyId) : null,
    );
    const rows: Row[] = await this.db.query(sql, params);
    return rows.filter((r) => r.first_seen_at > visit.lastVisitAt).length;
  }

  /** Regista a visita (e os filtros usados): o que já viu deixa de ser novo. */
  async markVisited(userId: string, query: JobFeedQuery): Promise<void> {
    await this.db.query(
      `INSERT INTO job_feed_visits (user_id, last_visit_at, query)
       VALUES ($1, now(), $2)
       ON CONFLICT (user_id) DO UPDATE SET last_visit_at = now(), query = $2`,
      [userId, JSON.stringify(query)],
    );
  }

  /** Os filtros da última visita, para a página abrir como o utilizador a deixou. */
  async lastQuery(userId: string): Promise<JobFeedQuery | null> {
    return (await this.visit(userId))?.query ?? null;
  }

  // ── Auxiliares ──────────────────────────────────────────────

  private filtered(
    q: JobFeedQuery,
    stackIds: string[] | null,
  ): [string, unknown[]] {
    const where = ['closed_at IS NULL'];
    const params: unknown[] = [];
    const p = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };

    if (!q.includeUnrealistic) where.push(`accessibility <> 'UNREALISTIC'`);

    // Distritos e remoto juntam-se: "Porto ou remoto".
    const place: string[] = [];
    if (q.locations?.length)
      place.push(`location_ids && ${p(q.locations)}::int[]`);
    if (q.remote) place.push(`work_mode = 'REMOTE'`);
    if (place.length) where.push(`(${place.join(' OR ')})`);

    // Vagas sem contrato indicado ficam: não se sabe, não se exclui.
    if (q.contracts?.length)
      where.push(
        `(contract_ids = '{}' OR contract_ids && ${p(q.contracts)}::int[])`,
      );

    if (stackIds) where.push(`competency_ids && ${p(stackIds)}::text[]`);

    return [
      `SELECT * FROM job_listings WHERE ${where.join(' AND ')}
        ORDER BY published_at DESC LIMIT 500`,
      params,
    ];
  }

  private async visit(
    userId: string,
  ): Promise<{ lastVisitAt: Date; query: JobFeedQuery } | null> {
    const [row] = await this.db.query(
      `SELECT last_visit_at, query FROM job_feed_visits WHERE user_id = $1`,
      [userId],
    );
    return row
      ? { lastVisitAt: row.last_visit_at, query: row.query ?? {} }
      : null;
  }

  private async declared(userId: string): Promise<Set<string>> {
    const rows: { competency_id: string }[] = await this.db.query(
      `SELECT competency_id FROM profile_competencies WHERE user_id = $1`,
      [userId],
    );
    return new Set(rows.map((r) => r.competency_id));
  }

  private stackExists(id: string): boolean {
    return this.catalog.findStacks().some((s) => s.id === id);
  }
}

function toListing(r: Row): JobListing {
  return {
    id: r.id,
    source: 'itjobs',
    title: r.title,
    companyName: r.company_name,
    companyLogo: r.company_logo,
    url: r.url,
    locations: r.locations,
    locationIds: r.location_ids,
    workMode: r.work_mode,
    contractIds: r.contract_ids,
    summary: r.summary,
    publishedAt: new Date(r.published_at).toISOString(),
    firstSeenAt: new Date(r.first_seen_at).toISOString(),
    seniority: r.seniority,
    yearsRequired: r.years_required,
    accessibility: r.accessibility,
    mislabeledJunior: r.mislabeled_junior,
    competencyIds: r.competency_ids,
    experienceRequirements: r.experience_requirements,
    otherSkills: r.other_skills ?? [],
    analyzedBy: r.analysis_source,
  };
}
