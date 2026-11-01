import { CurrentUserId, RequireUserGuard } from '@devstart/backend-common';
import { ReplyDraft } from '@devstart/shared-types';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AnalyzeReplyDto } from './dto/analyze-reply.dto';
import { RepliesService } from './replies.service';

/**
 * Debaixo de /jobs: passa pela mesma rota do gateway e do nginx que a análise
 * de anúncios (com o tempo de espera maior que a IA precisa).
 */
@Controller('jobs/replies')
@UseGuards(RequireUserGuard)
export class RepliesController {
  constructor(private readonly replies: RepliesService) {}

  /** Lê a resposta de uma empresa e propõe o que mudar no quadro. */
  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  analyze(
    @CurrentUserId() userId: string,
    @Body() dto: AnalyzeReplyDto,
  ): Promise<ReplyDraft> {
    return this.replies.analyze(userId, dto);
  }
}
