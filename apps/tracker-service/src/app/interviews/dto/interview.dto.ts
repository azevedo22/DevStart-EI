import { TrimToNull } from '@devstart/backend-common';
import {
  APPLICATION_LIMITS,
  INTERVIEW_TYPES,
  InterviewOutcome,
  InterviewType,
  SaveInterviewRequest,
} from '@devstart/shared-types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const OUTCOMES: InterviewOutcome[] = ['PASSED', 'FAILED', 'PENDING'];

export class SaveInterviewDto implements SaveInterviewRequest {
  @IsIn(INTERVIEW_TYPES, { message: 'Tipo inválido.' })
  type!: InterviewType;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601({}, { message: 'Data inválida.' })
  scheduledAt?: string | null;

  @IsBoolean()
  completed!: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'A avaliação vai de 1 a 5.' })
  @Max(5, { message: 'A avaliação vai de 1 a 5.' })
  rating?: number | null;

  @IsIn(OUTCOMES, { message: 'Resultado inválido.' })
  outcome!: InterviewOutcome;

  /** Perguntas vazias são descartadas; cada uma é cortada nas pontas. */
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
          .map((q) => (typeof q === 'string' ? q.trim() : q))
          .filter((q) => q !== '')
      : value,
  )
  @IsArray()
  @ArrayMaxSize(APPLICATION_LIMITS.questions)
  @IsString({ each: true })
  @MaxLength(APPLICATION_LIMITS.questionLength, { each: true })
  questionsAsked!: string[];

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(APPLICATION_LIMITS.feedbackText)
  strengths?: string | null;

  @IsOptional()
  @TrimToNull()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(APPLICATION_LIMITS.feedbackText)
  improvements?: string | null;
}
