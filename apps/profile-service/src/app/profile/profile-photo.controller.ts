/// <reference types="multer" />
import { CurrentUserId, RequireUserGuard } from '@devstart/backend-common';
import { PROFILE_PHOTO_LIMITS } from '@devstart/shared-types';
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Put,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { detectImageType } from './profile-photo';

/**
 * A foto de perfil do próprio utilizador. Guardada na base de dados (é
 * pequena: o browser reduz para 512×512 antes de enviar) e servida só a quem
 * a carregou.
 */
@Controller('profile/photo')
@UseGuards(RequireUserGuard)
export class ProfilePhotoController {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  @Get()
  async get(
    @CurrentUserId() userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const [row] = await this.db.query(
      `SELECT content, mime_type, updated_at FROM profile_photos WHERE user_id = $1`,
      [userId],
    );
    if (!row) throw new NotFoundException('Ainda sem foto de perfil.');
    res.set({
      // Dados pessoais: nunca em cache partilhada.
      'Cache-Control': 'private, no-cache',
      'Last-Modified': new Date(row.updated_at).toUTCString(),
      // O browser não adivinha o tipo: é sempre o que foi verificado no envio.
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline; filename="foto.jpg"',
    });
    return new StreamableFile(row.content as Buffer, { type: row.mime_type });
  }

  /** Multipart, campo "file". Só JPEG, PNG ou WebP, verificados pelos primeiros bytes. */
  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: PROFILE_PHOTO_LIMITS.maxUploadBytes, files: 1 },
    }),
  )
  async upload(
    @CurrentUserId() userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<void> {
    if (!file?.buffer?.length)
      throw new BadRequestException('Escolhe uma imagem.');
    const type = detectImageType(file.buffer);
    if (!type)
      throw new BadRequestException('A foto tem de ser JPEG, PNG ou WebP.');
    await this.db.query(
      `INSERT INTO profile_photos (user_id, content, mime_type, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id) DO UPDATE
         SET content = EXCLUDED.content, mime_type = EXCLUDED.mime_type, updated_at = now()`,
      [userId, file.buffer, type],
    );
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUserId() userId: string): Promise<void> {
    await this.db.query(`DELETE FROM profile_photos WHERE user_id = $1`, [
      userId,
    ]);
  }
}
