import {
  APPLICATION_LIMITS,
  JobListingTextsRequest,
} from '@devstart/shared-types';
import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

export class JobListingTextsDto implements JobListingTextsRequest {
  @IsArray()
  @ArrayMaxSize(APPLICATION_LIMITS.applicationsPerUser)
  @IsString({ each: true })
  @MaxLength(APPLICATION_LIMITS.url, { each: true })
  urls!: string[];
}
