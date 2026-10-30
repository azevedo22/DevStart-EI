import {
  DeclareCompetencyRequest,
  LEVELS,
  Level,
  BACKGROUND_LIMITS,
  PROFILE_LIMITS,
  UpdateProfileRequest,
} from '@devstart/shared-types';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { TrimToNull } from '@devstart/backend-common';

/** Só http(s) e com protocolo: os links são mostrados como <a href>. */
export const URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
};
const urlMessage = (what: string) =>
  `O link ${what} tem de começar por http:// ou https://.`;

const maxGraduationYear = () =>
  new Date().getFullYear() + PROFILE_LIMITS.maxGraduationYearAhead;

/** Todos os campos são opcionais: só se altera o que vier no pedido. `null` limpa o campo. */
export class UpdateProfileDto implements UpdateProfileRequest {
  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(PROFILE_LIMITS.headline)
  headline?: string | null;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(PROFILE_LIMITS.university)
  university?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt({ message: 'Ano de conclusão inválido.' })
  @Min(PROFILE_LIMITS.minGraduationYear, {
    message: 'Ano de conclusão inválido.',
  })
  @Max(maxGraduationYear(), { message: 'Ano de conclusão inválido.' })
  graduationYear?: number | null;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(PROFILE_LIMITS.bio)
  bio?: string | null;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(BACKGROUND_LIMITS.location)
  location?: string | null;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @MaxLength(PROFILE_LIMITS.url)
  @IsUrl(URL_OPTIONS, { message: urlMessage('do LinkedIn') })
  linkedinUrl?: string | null;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @MaxLength(PROFILE_LIMITS.url)
  @IsUrl(URL_OPTIONS, { message: urlMessage('do GitHub') })
  githubUrl?: string | null;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @MaxLength(PROFILE_LIMITS.url)
  @IsUrl(URL_OPTIONS, { message: urlMessage('do portefólio') })
  portfolioUrl?: string | null;
}

export class DeclareCompetencyDto implements DeclareCompetencyRequest {
  @IsIn(LEVELS, { message: 'Nível inválido.' })
  level!: Level;
}
