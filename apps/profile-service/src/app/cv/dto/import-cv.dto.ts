import {
  BACKGROUND_LIMITS,
  ImportCvRequest,
  LEVELS,
  Level,
} from '@devstart/shared-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  LanguageSkillDto,
  SaveEducationDto,
  SaveExperienceDto,
} from '../../background/dto/background.dto';
import { UpdateProfileDto } from '../../profile/dto/profile.dto';
import { SaveProjectDto } from '../../projects/dto/project.dto';

export class ImportCompetencyDto {
  @IsString()
  competencyId!: string;

  @IsIn(LEVELS, { message: 'Nível inválido.' })
  level!: Level;
}

/**
 * O que o utilizador escolheu importar. Cada parte passa pelas mesmas
 * validações que os endpoints normais (o rascunho veio de uma IA e foi
 * editado no browser: não se confia em nenhum dos dois).
 */
export class ImportCvDto implements ImportCvRequest {
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProfileDto)
  fields?: UpdateProfileDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BACKGROUND_LIMITS.educationPerUser)
  @ValidateNested({ each: true })
  @Type(() => SaveEducationDto)
  education?: SaveEducationDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BACKGROUND_LIMITS.experiencePerUser)
  @ValidateNested({ each: true })
  @Type(() => SaveExperienceDto)
  experience?: SaveExperienceDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BACKGROUND_LIMITS.languagesPerUser)
  @ValidateNested({ each: true })
  @Type(() => LanguageSkillDto)
  languages?: LanguageSkillDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ImportCompetencyDto)
  competencies?: ImportCompetencyDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SaveProjectDto)
  projects?: SaveProjectDto[];

  @IsOptional()
  @IsBoolean()
  replacePrevious?: boolean;
}
