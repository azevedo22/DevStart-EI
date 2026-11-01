import {
  AnalyzeReplyRequest,
  REPLY_LIMITS,
  ReplyCandidate,
} from '@devstart/shared-types';
import { Trim } from '@devstart/backend-common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ReplyCandidateDto implements ReplyCandidate {
  @IsUUID()
  id!: string;

  @IsString()
  @MaxLength(200)
  companyName!: string;

  @IsString()
  @MaxLength(200)
  jobTitle!: string;
}

export class AnalyzeReplyDto implements AnalyzeReplyRequest {
  @Trim()
  @IsString()
  @Length(REPLY_LIMITS.minText, REPLY_LIMITS.maxText, {
    message: `Cola o texto da resposta (entre ${REPLY_LIMITS.minText} e ${REPLY_LIMITS.maxText} caracteres).`,
  })
  text!: string;

  @IsArray()
  @ArrayMaxSize(REPLY_LIMITS.maxCandidates)
  @ValidateNested({ each: true })
  @Type(() => ReplyCandidateDto)
  candidates!: ReplyCandidateDto[];

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data de hoje inválida.' })
  today!: string;
}
