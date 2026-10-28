import { CurrentUserId, RequireUserGuard } from '@devstart/backend-common';
import { Interview } from '@devstart/shared-types';
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { SaveInterviewDto } from './dto/interview.dto';
import { InterviewsService } from './interviews.service';

const Id = () =>
  Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND }));

/** Criar entrevistas é em /applications/:id/interviews; aqui edita-se e apaga-se. */
@Controller('interviews')
@UseGuards(RequireUserGuard)
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @Put(':id')
  update(
    @CurrentUserId() userId: string,
    @Id() id: string,
    @Body() dto: SaveInterviewDto,
  ): Promise<Interview> {
    return this.interviews.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUserId() userId: string, @Id() id: string): Promise<void> {
    return this.interviews.remove(userId, id);
  }
}
