import { Trim, TrimToNull } from '@devstart/backend-common';
import {
  APPLICATION_LIMITS,
  APPLICATION_STATUSES,
  ApplicationStatus,
  MoveApplicationRequest,
  SENIORITIES,
  SaveApplicationRequest,
  Seniority,
  WORK_MODES,
  WorkMode,
} from '@devstart/shared-types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * Os ids de competências pertencem ao catálogo do Profile Service. Este serviço
 * não tem o catálogo, por isso valida só o formato (slug). O frontend só deixa
 * escolher ids do catálogo; um id desconhecido fica guardado mas não estraga nada.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class SaveApplicationDto implements SaveApplicationRequest {
  @Trim()
  @IsString()
  @Length(1, APPLICATION_LIMITS.companyName, { message: 'Indica a empresa.' })
  companyName!: string;

  @Trim()
  @IsString()
  @Length(2, APPLICATION_LIMITS.jobTitle, {
    message: 'Indica o título da vaga.',
  })
  jobTitle!: string;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @MaxLength(APPLICATION_LIMITS.url)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'O link tem de começar por http:// ou https://.' },
  )
  jobUrl?: string | null;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(APPLICATION_LIMITS.location)
  location?: string | null;

  @IsIn(WORK_MODES, { message: 'Modalidade inválida.' })
  workMode!: WorkMode;

  @IsArray()
  @ArrayMaxSize(APPLICATION_LIMITS.competencies)
  @ArrayUnique()
  @Matches(SLUG, { each: true, message: 'Id de competência inválido.' })
  requiredCompetencyIds!: string[];

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt({ message: 'Anos de experiência inválidos.' })
  @Min(0)
  @Max(30)
  yearsRequired?: number | null;

  /** Linhas vazias saem; espaços nas pontas também. */
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
          .map((v) => (typeof v === 'string' ? v.trim() : v))
          .filter((v) => v !== '')
      : value,
  )
  @IsArray()
  @ArrayMaxSize(APPLICATION_LIMITS.experienceItems)
  @IsString({ each: true })
  @MaxLength(APPLICATION_LIMITS.experienceItem, {
    each: true,
    message: `Cada experiência pedida tem até ${APPLICATION_LIMITS.experienceItem} caracteres.`,
  })
  experienceRequirements?: string[];

  @IsIn(SENIORITIES, { message: 'Senioridade inválida.' })
  seniority!: Seniority;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data inválida (AAAA-MM-DD).' })
  @IsISO8601({ strict: true }, { message: 'Data inválida (AAAA-MM-DD).' })
  appliedAt!: string;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(APPLICATION_LIMITS.notes)
  notes?: string | null;

  @IsOptional()
  @IsIn(APPLICATION_STATUSES, { message: 'Estado inválido.' })
  status?: ApplicationStatus;
}

export class MoveApplicationDto implements MoveApplicationRequest {
  @IsIn(APPLICATION_STATUSES, { message: 'Estado inválido.' })
  status!: ApplicationStatus;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  position!: number;
}
