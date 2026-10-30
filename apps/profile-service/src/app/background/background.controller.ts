import { Education, Experience, LanguageSkill } from '@devstart/shared-types';
import { CurrentUserId, RequireUserGuard } from '@devstart/backend-common';
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { BackgroundService } from './background.service';
import {
  SaveEducationDto,
  SaveExperienceDto,
  SaveLanguagesDto,
} from './dto/background.dto';

/** Um id que não é uuid não pode existir: 404, como um id inexistente. */
const RecordId = () =>
  Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND }));

/** Formação, experiência e línguas. A leitura vem com o perfil (GET /profile). */
@Controller('profile')
@UseGuards(RequireUserGuard)
export class BackgroundController {
  constructor(private readonly background: BackgroundService) {}

  @Post('education')
  addEducation(
    @CurrentUserId() userId: string,
    @Body() dto: SaveEducationDto,
  ): Promise<Education> {
    return this.background.addEducation(userId, dto);
  }

  @Put('education/:id')
  updateEducation(
    @CurrentUserId() userId: string,
    @RecordId() id: string,
    @Body() dto: SaveEducationDto,
  ): Promise<Education> {
    return this.background.updateEducation(userId, id, dto);
  }

  @Delete('education/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeEducation(
    @CurrentUserId() userId: string,
    @RecordId() id: string,
  ): Promise<void> {
    return this.background.removeEducation(userId, id);
  }

  @Post('experience')
  addExperience(
    @CurrentUserId() userId: string,
    @Body() dto: SaveExperienceDto,
  ): Promise<Experience> {
    return this.background.addExperience(userId, dto);
  }

  @Put('experience/:id')
  updateExperience(
    @CurrentUserId() userId: string,
    @RecordId() id: string,
    @Body() dto: SaveExperienceDto,
  ): Promise<Experience> {
    return this.background.updateExperience(userId, id, dto);
  }

  @Delete('experience/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeExperience(
    @CurrentUserId() userId: string,
    @RecordId() id: string,
  ): Promise<void> {
    return this.background.removeExperience(userId, id);
  }

  @Put('languages')
  replaceLanguages(
    @CurrentUserId() userId: string,
    @Body() dto: SaveLanguagesDto,
  ): Promise<LanguageSkill[]> {
    return this.background.replaceLanguages(userId, dto.languages);
  }
}
