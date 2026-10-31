import {
  analyzeJobPosting,
  classifyAccessibility,
  JOB_FEED_LIMITS,
} from '@devstart/shared-types';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { COMPETENCIES } from '../catalog/seed/competencies.seed';
import { Env } from '../config/env';
import { JobsService } from '../jobs/jobs.service';
import {
  htmlToText,
  ItjobsClient,
  ItjobsError,
  ItjobsJob,
  jobUrl,
  summarize,
  workModeOf,
} from './itjobs.client';

/**
 * Pesquisas feitas ao ITJobs.pt em cada recolha: termos de vagas de entrada.
 * Cada termo é um pedido próprio; as vagas repetidas juntam-se pelo id.
 */
export const SEARCH_TERMS = [
  'junior',
  'júnior',
  'estágio',
  'trainee',
  'graduate',
  'recém-licenciado',
  'entry level',
];
const PAGE_SIZE = 50;
const MAX_PAGES = 3;
/**
 * O texto enviado à IA. Os requisitos vêm quase sempre no início; cortar
 * poupa tokens, e o limite gratuito da Groq conta tokens por minuto.
 */
const MAX_AI_TEXT = 6_000;
/**
 * Em fundo, pode esperar que o limite por minuto reabra (a Groq diz quanto
 * tempo). Ler 10 vagas pode levar alguns minutos: não faz mal.
 */
const AI_RATE_LIMIT = { maxWaitMs: 65_000, maxRetries: 3 };

export interface SyncResult {
  fetched: number;
  added: number;
  closed: number;
  analyzedByAi: number;
}

/**
 * Recolha de vagas do ITJobs.pt, de N em N minutos (JOB_SYNC_INTERVAL_MINUTES).
 *
 * - Vagas novas: triagem por palavras-chave logo à entrada (grátis).
 * - IA: até JOB_SYNC_AI_PER_RUN vagas novas por recolha, as mais recentes e
 *   não excluídas pela triagem; as outras ficam para a recolha seguinte. Cada
 *   vaga é lida uma única vez, para todos os utilizadores. Se o fornecedor
 *   pedir para esperar (limite por minuto), espera e continua.
 * - Vagas que deixam de aparecer no ITJobs são marcadas como fechadas.
 *
 * Ao arrancar, só recolhe se a última recolha já tiver passado do intervalo:
 * reiniciar o serviço (ex.: em desenvolvimento) não gasta pedidos.
 */
@Injectable()
export class JobSyncService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger('Vagas');
  private readonly client: ItjobsClient;
  private running: Promise<SyncResult> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly jobs: JobsService,
    @InjectDataSource() private readonly db: DataSource,
  ) {
    this.client = new ItjobsClient(
      config.get('ITJOBS_BASE_URL', { infer: true }),
      config.get('ITJOBS_API_KEY', { infer: true }),
    );
  }

  get enabled(): boolean {
    return this.client.enabled;
  }

  private get intervalMs(): number {
    return (
      this.config.get('JOB_SYNC_INTERVAL_MINUTES', { infer: true }) * 60_000
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    if (!this.enabled) {
      this.logger.log(
        'Recolha de vagas desligada: falta ITJOBS_API_KEY no .env.',
      );
      return;
    }
    if (!this.intervalMs) {
      this.logger.log(
        'Recolha automática desligada (JOB_SYNC_INTERVAL_MINUTES=0).',
      );
      return;
    }
    const last = await this.lastSyncAt();
    const due = last ? last.getTime() + this.intervalMs - Date.now() : 0;
    this.schedule(Math.max(5_000, due));
  }

  onApplicationShutdown(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule(delayMs: number): void {
    this.timer = setTimeout(async () => {
      await this.sync().catch(() => undefined);
      this.schedule(this.intervalMs);
    }, delayMs);
    this.timer.unref?.();
  }

  /** A última recolha bem-sucedida: a vaga vista mais recentemente. */
  async lastSyncAt(): Promise<Date | null> {
    const [row] = await this.db.query(
      `SELECT max(last_seen_at) AS at FROM job_listings`,
    );
    return row?.at ? new Date(row.at) : null;
  }

  /** Uma recolha de cada vez: chamadas em simultâneo esperam pela mesma. */
  sync(): Promise<SyncResult> {
    this.running ??= this.run().finally(() => (this.running = null));
    return this.running;
  }

  private async run(): Promise<SyncResult> {
    if (!this.enabled) throw new ItjobsError('falta ITJOBS_API_KEY');
    const started = Date.now();
    let jobs: Map<number, ItjobsJob>;
    try {
      jobs = await this.fetchAll();
    } catch (err) {
      this.logger.warn(`Recolha falhou: ${(err as Error).message}.`);
      throw err;
    }

    const now = new Date();
    const existing = new Set<string>(
      (
        await this.db.query(
          `SELECT source_id FROM job_listings WHERE source = 'itjobs'`,
        )
      ).map((r: { source_id: string }) => r.source_id),
    );

    let added = 0;
    for (const job of jobs.values()) {
      if (existing.has(String(job.id))) continue;
      await this.insert(job, now);
      added++;
    }

    const seen = [...jobs.keys()].map(String);
    // Reabre as que voltaram a aparecer e marca como vistas.
    await this.db.query(
      `UPDATE job_listings SET last_seen_at = $1, closed_at = NULL
        WHERE source = 'itjobs' AND source_id = ANY($2)`,
      [now, seen],
    );
    // Uma recolha vazia é suspeita (API em baixo?): não fecha nada.
    let closed = 0;
    if (seen.length) {
      const res = await this.db.query(
        `UPDATE job_listings SET closed_at = $1
          WHERE source = 'itjobs' AND closed_at IS NULL AND NOT (source_id = ANY($2))`,
        [now, seen],
      );
      closed = res[1] ?? 0;
    }

    const analyzedByAi = await this.analyzePending();
    const result = { fetched: jobs.size, added, closed, analyzedByAi };
    this.logger.log(
      `Recolha concluída em ${((Date.now() - started) / 1000).toFixed(1)} s: ` +
        `${result.fetched} vagas no ITJobs, ${added} novas, ${closed} fechadas, ` +
        `${analyzedByAi} lidas pela IA.`,
    );
    return result;
  }

  private async fetchAll(): Promise<Map<number, ItjobsJob>> {
    const jobs = new Map<number, ItjobsJob>();
    for (const term of SEARCH_TERMS) {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const results = await this.client.search(term, page, PAGE_SIZE);
        for (const r of results) if (r?.id && r.title) jobs.set(r.id, r);
        if (results.length < PAGE_SIZE) break;
      }
    }
    return jobs;
  }

  /** Vaga nova: triagem por palavras-chave à entrada. */
  private async insert(job: ItjobsJob, now: Date): Promise<void> {
    const text = htmlToText(job.body ?? '');
    const a = analyzeJobPosting({ title: job.title, text }, COMPETENCIES);
    await this.db.query(
      `INSERT INTO job_listings (
         source, source_id, title, company_name, company_logo, url, locations,
         location_ids, work_mode, contract_ids, body, summary, published_at,
         seniority, years_required, accessibility, mislabeled_junior,
         competency_ids, experience_requirements, analysis_source,
         analyzed_at, first_seen_at, last_seen_at)
       VALUES ('itjobs', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
               $13, $14, $15, $16, $17, '{}', 'keywords', $18, $18, $18)
       ON CONFLICT (source, source_id) DO NOTHING`,
      [
        String(job.id),
        job.title.slice(0, 200),
        (job.company?.name ?? 'Empresa não indicada').slice(0, 160),
        /^https:\/\//.test(job.company?.logo ?? '')
          ? job.company!.logo!.slice(0, 500)
          : null,
        jobUrl(job).slice(0, 500),
        (job.locations ?? []).map((l) => l.name),
        (job.locations ?? []).map((l) => l.id),
        workModeOf(job),
        (job.contracts ?? []).map((c) => c.id),
        text,
        summarize(text, JOB_FEED_LIMITS.summaryLength),
        parseDate(job.publishedAt) ?? now,
        a.seniority,
        a.yearsRequired,
        a.accessibility,
        a.mislabeledJunior,
        a.competencyIds,
        now,
      ],
    );
  }

  /**
   * A IA lê as vagas que só passaram a triagem, as mais recentes primeiro,
   * até ao limite por recolha. As que a triagem já deu como pouco realistas
   * não gastam IA. Se a IA não responder, para e tenta na próxima recolha.
   */
  private async analyzePending(): Promise<number> {
    const limit = this.config.get('JOB_SYNC_AI_PER_RUN', { infer: true });
    if (!limit) return 0;
    const pending: { id: string; title: string; body: string }[] =
      await this.db.query(
        `SELECT id, title, body FROM job_listings
          WHERE analysis_source = 'keywords' AND closed_at IS NULL
            AND accessibility <> 'UNREALISTIC'
          ORDER BY published_at DESC
          LIMIT $1`,
        [limit],
      );

    let done = 0;
    for (const p of pending) {
      const text = `${p.title}\n\n${p.body}`.slice(0, MAX_AI_TEXT);
      const d = await this.jobs.read(text, AI_RATE_LIMIT);
      // IA indisponível (ou limite diário): as restantes ficam para a próxima.
      if (d.source !== 'ai') break;
      const verdict = classifyAccessibility({
        yearsRequired: d.yearsRequired,
        seniority: d.seniority,
      });
      await this.db.query(
        `UPDATE job_listings SET
           seniority = $2, years_required = $3, accessibility = $4,
           mislabeled_junior = $5, competency_ids = $6,
           experience_requirements = $7, analysis_source = 'ai',
           analyzed_at = now()
         WHERE id = $1`,
        [
          p.id,
          d.seniority,
          d.yearsRequired,
          verdict.accessibility,
          verdict.mislabeledJunior,
          d.competencyIds,
          d.experienceRequirements,
        ],
      );
      done++;
    }
    return done;
  }
}

/** "AAAA-MM-DD HH:MM:SS" do ITJobs (hora de Lisboa) → Date. */
function parseDate(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const d = new Date(s.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d;
}
