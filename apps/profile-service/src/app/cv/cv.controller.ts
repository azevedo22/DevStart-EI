/// <reference types="multer" />
import {
  CV_LIMITS,
  CvDraft,
  CvReaderInfo,
  Profile,
} from '@devstart/shared-types';
import { CurrentUserId, RequireUserGuard } from '@devstart/backend-common';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CvService } from './cv.service';
import { ImportCvDto } from './dto/import-cv.dto';

@Controller('profile/cv')
@UseGuards(RequireUserGuard)
export class CvController {
  constructor(private readonly cv: CvService) {}

  /** Que IA vai ler o CV e se é um serviço externo: mostrado antes do envio. */
  @Get('reader')
  reader(): CvReaderInfo {
    return this.cv.reader();
  }

  /**
   * Recebe o CV (multipart, campo "file") e devolve o rascunho extraído.
   * O ficheiro fica só em memória durante o pedido: nunca é escrito em disco.
   */
  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: CV_LIMITS.maxFileBytes, files: 1 },
    }),
  )
  analyze(
    @CurrentUserId() userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<CvDraft> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Escolhe o ficheiro do CV (PDF ou DOCX).');
    }
    return this.cv.analyze(userId, file.buffer);
  }

  /** Grava o que o utilizador escolheu na revisão. Devolve o perfil atualizado. */
  @Post('import')
  @HttpCode(HttpStatus.OK)
  import(
    @CurrentUserId() userId: string,
    @Body() dto: ImportCvDto,
  ): Promise<Profile> {
    return this.cv.import(userId, dto);
  }
}
