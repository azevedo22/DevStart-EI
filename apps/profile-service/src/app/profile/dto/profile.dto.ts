import {
  DeclareCompetencyRequest,
  LEVELS,
  Level,
  PROFILE_LIMITS,
  UpdateProfileRequest,
} from '@devstart/shared-types';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { TrimToNull } from '../../common/transforms';

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
}

export class DeclareCompetencyDto implements DeclareCompetencyRequest {
  @IsIn(LEVELS, { message: 'Nível inválido.' })
  level!: Level;
}
