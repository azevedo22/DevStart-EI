import {
  BACKGROUND_LIMITS,
  EXPERIENCE_KINDS,
  ExperienceKind,
  LANGUAGE_LEVELS,
  LanguageLevel,
  LanguageSkill,
  SaveEducationRequest,
  SaveExperienceRequest,
  YEAR_MONTH_PATTERN,
} from '@devstart/shared-types';
import { Trim, TrimToNull } from '@devstart/backend-common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const MIN_YEAR = 1950;
const maxYear = () => new Date().getFullYear() + 8;
const yearMessage = 'Ano inválido.';

export class SaveEducationDto implements SaveEducationRequest {
  @Trim()
  @IsString()
  @Length(2, BACKGROUND_LIMITS.institution, {
    message: 'Indica a instituição.',
  })
  institution!: string;

  @Trim()
  @IsString()
  @Length(2, BACKGROUND_LIMITS.degree, { message: 'Indica o grau ou curso.' })
  degree!: string;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(BACKGROUND_LIMITS.fieldOfStudy)
  fieldOfStudy!: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt({ message: yearMessage })
  @Min(MIN_YEAR, { message: yearMessage })
  @Max(maxYear(), { message: yearMessage })
  startYear!: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt({ message: yearMessage })
  @Min(MIN_YEAR, { message: yearMessage })
  @Max(maxYear(), { message: yearMessage })
  endYear!: number | null;
}

const monthMessage = 'Data inválida (usa AAAA-MM).';

export class SaveExperienceDto implements SaveExperienceRequest {
  @Trim()
  @IsString()
  @Length(2, BACKGROUND_LIMITS.organization, {
    message: 'Indica a organização.',
  })
  organization!: string;

  @Trim()
  @IsString()
  @Length(2, BACKGROUND_LIMITS.role, { message: 'Indica a função.' })
  role!: string;

  @IsIn(EXPERIENCE_KINDS, { message: 'Tipo de experiência inválido.' })
  kind!: ExperienceKind;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @Matches(YEAR_MONTH_PATTERN, { message: monthMessage })
  startDate!: string | null;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @Matches(YEAR_MONTH_PATTERN, { message: monthMessage })
  endDate!: string | null;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(BACKGROUND_LIMITS.experienceDescription)
  description!: string | null;
}

export class LanguageSkillDto implements LanguageSkill {
  @Trim()
  @IsString()
  @Length(2, BACKGROUND_LIMITS.language, { message: 'Indica a língua.' })
  language!: string;

  @IsIn(LANGUAGE_LEVELS, { message: 'Nível de língua inválido.' })
  level!: LanguageLevel;
}

export class SaveLanguagesDto {
  @IsArray()
  @ArrayMaxSize(BACKGROUND_LIMITS.languagesPerUser)
  @ValidateNested({ each: true })
  @Type(() => LanguageSkillDto)
  languages!: LanguageSkillDto[];
}
