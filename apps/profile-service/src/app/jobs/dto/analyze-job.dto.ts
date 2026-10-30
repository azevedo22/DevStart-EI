import {
  AnalyzeJobPostingRequest,
  JOB_POSTING_LIMITS,
} from '@devstart/shared-types';
import { Trim } from '@devstart/backend-common';
import { IsString, Length } from 'class-validator';

export class AnalyzeJobPostingDto implements AnalyzeJobPostingRequest {
  @Trim()
  @IsString()
  @Length(JOB_POSTING_LIMITS.minText, JOB_POSTING_LIMITS.maxText, {
    message: `Cola o texto do anúncio (entre ${JOB_POSTING_LIMITS.minText} e ${JOB_POSTING_LIMITS.maxText} caracteres).`,
  })
  text!: string;
}
