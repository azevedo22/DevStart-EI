import {
  CvDraft,
  CvReaderInfo,
  ImportCvRequest,
  PROFILE_LIMITS,
  Profile,
} from '@devstart/shared-types';
import {
  ConflictException,
  HttpException,
  Inject,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BackgroundService } from '../background/background.service';
import {
  EducationEntity,
  ExperienceEntity,
} from '../background/background.entities';
import { CatalogService } from '../catalog/catalog.service';
import { COMPETENCIES } from '../catalog/seed/competencies.seed';
import {
  ProfileCompetencyEntity,
  ProfileEntity,
} from '../profile/profile.entities';
import { ProfileService } from '../profile/profile.service';
import { ProjectEntity } from '../projects/project.entities';
import { toProjectFields } from '../projects/projects.service';
import { CV_EXTRACTION_SCHEMA, CV_SYSTEM_PROMPT } from './cv-extraction.schema';
import { keywordOnlyDraft, normalizeCvExtraction } from './cv-normalize';
import { extractCvText } from './cv-text';
import { AiQuota } from '../ai/ai-quota';
import { LlmUnavailableError, STRUCTURED_LLM, StructuredLlm } from '../ai/llm';

/**
 * Importação do CV.
 *
 * analyze(): lê o ficheiro, pede ao modelo os dados estruturados e devolve um
 * rascunho. Não grava nada e não guarda o ficheiro.
 *
 * import(): grava o que o utilizador escolheu, numa transação. Itens que já
 * existem no perfil (mesma formação, experiência ou projeto) não são duplicados,
 * para importar o mesmo CV duas vezes não estragar nada.
 */
@Injectable()
export class CvService {
  private readonly logger = new Logger(CvService.name);
  /** Uma análise de cada vez por utilizador: o modelo é pesado. */
  private readonly analyzing = new Set<string>();

  constructor(
    @Inject(STRUCTURED_LLM) private readonly llm: StructuredLlm,
    private readonly catalog: CatalogService,
    private readonly background: BackgroundService,
    private readonly profile: ProfileService,
    private readonly quota: AiQuota,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  /** Quem lê o CV, para o frontend avisar antes do envio. */
  reader(): CvReaderInfo {
    return {
      label: this.llm.label,
      externalProvider: this.llm.remote ? this.llm.provider : null,
    };
  }

  async analyze(userId: string, file: Buffer): Promise<CvDraft> {
    if (this.analyzing.has(userId)) {
      throw new HttpException(
        'Já estou a analisar um CV teu. Espera que termine.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.analyzing.add(userId);
    try {
      const text = await extractCvText(file);
      // Conta só depois de o ficheiro se ler: um PDF inválido não gasta a quota.
      await this.quota.consume(userId);
      try {
        const raw = await this.llm.chatJson({
          system: CV_SYSTEM_PROMPT,
          user: `CV:\n"""\n${text}\n"""`,
          schema: CV_EXTRACTION_SCHEMA,
          name: 'cv_extraction',
          what: 'CV',
        });
        return {
          ...normalizeCvExtraction(raw, text, COMPETENCIES),
          analyzedBy: this.llm.label,
          sentToExternalService: this.llm.remote,
        };
      } catch (err) {
        if (!(err instanceof LlmUnavailableError)) throw err;
        this.logger.warn(`CV analisado sem IA: ${err.message}`);
        // Mesmo sem resposta útil, o CV pode ter sido enviado (ex.: chave errada).
        return {
          ...keywordOnlyDraft(text, COMPETENCIES, err.message),
          sentToExternalService: this.llm.remote,
        };
      }
    } finally {
      this.analyzing.delete(userId);
    }
  }

  async import(userId: string, req: ImportCvRequest): Promise<Profile> {
    const competencies = req.competencies ?? [];
    const projects = req.projects ?? [];
    this.catalog.assertCompetenciesExist([
      ...competencies.map((c) => c.competencyId),
      ...projects.flatMap((p) => p.competencyIds),
    ]);

    await this.db.transaction(async (em) => {
      // O mesmo bloqueio que o preenchimento da demonstração: duas importações
      // em simultâneo não duplicam nada.
      await em.query(`SELECT pg_advisory_xact_lock(hashtext('demo:' || $1))`, [
        userId,
      ]);

      const fields = Object.fromEntries(
        Object.entries(req.fields ?? {}).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(fields).length) {
        await em.upsert(ProfileEntity, { userId, ...fields }, ['userId']);
      }

      const existingEducation = await em.findBy(EducationEntity, { userId });
      const educationKey = (i: { institution: string; degree: string }) =>
        `${norm(i.institution)}|${norm(i.degree)}`;
      const seenEducation = new Set(existingEducation.map(educationKey));
      for (const e of req.education ?? []) {
        if (seenEducation.has(educationKey(e))) continue;
        seenEducation.add(educationKey(e));
        await this.background.addEducation(userId, e, em);
      }

      const existingExperience = await em.findBy(ExperienceEntity, { userId });
      const experienceKey = (i: {
        organization: string;
        role: string;
        startDate: string | null;
      }) => `${norm(i.organization)}|${norm(i.role)}|${i.startDate ?? ''}`;
      const seenExperience = new Set(existingExperience.map(experienceKey));
      for (const e of req.experience ?? []) {
        if (seenExperience.has(experienceKey(e))) continue;
        seenExperience.add(experienceKey(e));
        await this.background.addExperience(userId, e, em);
      }

      if (req.languages?.length) {
        await this.background.mergeLanguages(userId, req.languages, em);
      }

      // Competências: o nível escolhido na revisão substitui o anterior.
      for (const { competencyId, level } of competencies) {
        await em.upsert(
          ProfileCompetencyEntity,
          { userId, competencyId, level },
          ['userId', 'competencyId'],
        );
      }

      const existingTitles = new Set(
        (await em.findBy(ProjectEntity, { userId })).map((p) => norm(p.title)),
      );
      const newProjects = projects.filter((p) => {
        const key = norm(p.title);
        if (existingTitles.has(key)) return false;
        existingTitles.add(key);
        return true;
      });
      // existingTitles já inclui os novos.
      if (existingTitles.size > PROFILE_LIMITS.projectsPerUser) {
        throw new ConflictException(
          `Com estes projetos passarias o limite de ${PROFILE_LIMITS.projectsPerUser}.`,
        );
      }
      for (const p of newProjects) {
        await em.save(
          em.create(ProjectEntity, { userId, ...toProjectFields(p) }),
        );
      }
    });

    return this.profile.get(userId);
  }
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
