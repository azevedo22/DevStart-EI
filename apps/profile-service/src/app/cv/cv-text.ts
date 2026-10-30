import { CV_LIMITS } from '@devstart/shared-types';
import { BadRequestException } from '@nestjs/common';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export type CvFormat = 'pdf' | 'docx';

/**
 * Identifica o formato pelos primeiros bytes, não pela extensão nem pelo
 * Content-Type, que o cliente controla.
 */
export function detectFormat(buffer: Buffer): CvFormat | null {
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  // DOCX é um ZIP ("PK\x03\x04") com word/document.xml lá dentro.
  if (
    buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) &&
    buffer.includes('word/')
  ) {
    return 'docx';
  }
  return null;
}

/** Texto do CV, com espaços normalizados e cortado ao limite enviado ao modelo. */
export async function extractCvText(buffer: Buffer): Promise<string> {
  const format = detectFormat(buffer);
  if (!format) {
    throw new BadRequestException('O CV tem de ser um PDF ou um DOCX.');
  }

  let raw: string;
  try {
    if (format === 'pdf') {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        raw = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
    } else {
      raw = (await mammoth.extractRawText({ buffer })).value;
    }
  } catch {
    throw new BadRequestException(
      'Não foi possível ler o ficheiro. Está protegido por password ou danificado?',
    );
  }

  const text = raw
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (text.length < 50) {
    // Um PDF que é só uma imagem (CV digitalizado) não tem texto para ler.
    throw new BadRequestException(
      'Não encontrei texto no CV. Se for uma digitalização (imagem), exporta-o como PDF a partir do Word ou do Google Docs.',
    );
  }
  return text.slice(0, CV_LIMITS.maxTextChars);
}
