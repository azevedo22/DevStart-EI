import {
  INDUSTRY_PRACTICES,
  IndustryPractice,
  PROFILE_LIMITS,
  PROJECT_ORIGINS,
  ProjectOrigin,
  SaveProjectRequest,
} from '@devstart/shared-types';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Trim, TrimToNull } from '../../common/transforms';

/**
 * Só http(s) e com protocolo: estes links são mostrados como <a href>,
 * por isso um "javascript:..." nunca pode entrar.
 */
const URL_OPTIONS = { protocols: ['http', 'https'], require_protocol: true };

export class SaveProjectDto implements SaveProjectRequest {
  @Trim()
  @IsString()
  @Length(2, PROFILE_LIMITS.projectTitle, {
    message: `O título precisa de 2 a ${PROFILE_LIMITS.projectTitle} caracteres.`,
  })
  title!: string;

  @Trim()
  @IsString()
  @Length(10, PROFILE_LIMITS.projectDescription, {
    message: `A descrição precisa de 10 a ${PROFILE_LIMITS.projectDescription} caracteres.`,
  })
  description!: string;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @MaxLength(PROFILE_LIMITS.url)
  @IsUrl(URL_OPTIONS, {
    message: 'O link do repositório tem de começar por http:// ou https://.',
  })
  repositoryUrl?: string | null;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @MaxLength(PROFILE_LIMITS.url)
  @IsUrl(URL_OPTIONS, {
    message: 'O link da demo tem de começar por http:// ou https://.',
  })
  liveUrl?: string | null;

  @IsIn(PROJECT_ORIGINS, { message: 'Origem inválida.' })
  origin!: ProjectOrigin;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(PROFILE_LIMITS.academicContext)
  academicContext?: string | null;

  @IsArray()
  @ArrayMaxSize(PROFILE_LIMITS.competenciesPerProject, {
    message: `No máximo ${PROFILE_LIMITS.competenciesPerProject} competências por projeto.`,
  })
  @ArrayUnique({ message: 'Competências repetidas.' })
  @IsString({ each: true })
  competencyIds!: string[];

  @IsArray()
  @ArrayUnique({ message: 'Práticas repetidas.' })
  @IsIn(INDUSTRY_PRACTICES, { each: true, message: 'Prática inválida.' })
  practices!: IndustryPractice[];
}
