import { Profile, ProfileCompetency } from '@devstart/shared-types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId, RequireUserGuard } from '../common/current-user';
import { DeclareCompetencyDto, UpdateProfileDto } from './dto/profile.dto';
import { ProfileService } from './profile.service';

@Controller('profile')
@UseGuards(RequireUserGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  get(@CurrentUserId() userId: string): Promise<Profile> {
    return this.profile.get(userId);
  }

  @Put()
  update(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<Profile> {
    return this.profile.update(userId, dto);
  }

  /** PUT porque é idempotente: declarar duas vezes deixa o mesmo estado. */
  @Put('competencies/:competencyId')
  declare(
    @CurrentUserId() userId: string,
    @Param('competencyId') competencyId: string,
    @Body() dto: DeclareCompetencyDto,
  ): Promise<ProfileCompetency[]> {
    return this.profile.declareCompetency(userId, competencyId, dto);
  }

  @Delete('competencies/:competencyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUserId() userId: string,
    @Param('competencyId') competencyId: string,
  ): Promise<void> {
    return this.profile.removeCompetency(userId, competencyId);
  }
}
