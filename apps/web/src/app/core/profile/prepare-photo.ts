import { PROFILE_PHOTO_LIMITS } from '@devstart/shared-types';

export class PhotoError extends Error {}

/**
 * Prepara a foto no browser antes de a enviar: recorta ao centro em quadrado,
 * reduz para 512×512 e volta a codificar em JPEG. Uma foto de telemóvel de
 * 5 MB fica com ~100 KB, e a re-codificação apaga os metadados EXIF (onde
 * pode estar a localização GPS de onde foi tirada). A rotação do EXIF é
 * aplicada antes, para a foto não ficar deitada.
 */
export async function preparePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new PhotoError('Escolhe uma imagem (JPG, PNG ou WebP).');
  }
  if (file.size > PROFILE_PHOTO_LIMITS.maxInputBytes) {
    throw new PhotoError('A imagem tem mais de 15 MB.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Ex.: HEIC do iPhone, que a maioria dos browsers não abre.
    throw new PhotoError(
      'Não consegui abrir esta imagem. Usa um JPG, PNG ou WebP.',
    );
  }

  const size = PROFILE_PHOTO_LIMITS.size;
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PhotoError('O browser não conseguiu preparar a imagem.');
  // Fundo branco: um PNG transparente não fica preto em JPEG.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.88),
  );
  if (!blob) throw new PhotoError('O browser não conseguiu preparar a imagem.');
  return blob;
}
