export const IMAGE_FILE_ACCEPT = 'image/*,image/heic,image/heif,image/jpeg,image/png,.heic,.heif';

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
const MAX_OUTPUT_BYTES = 2.5 * 1024 * 1024;

export const resolveMediaUrl = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith('/uploads/')) {
    return `/api${trimmed}`;
  }
  return trimmed;
};

export const toCssBackgroundUrl = (value: string): string => {
  const resolved = resolveMediaUrl(value);
  const escaped = resolved.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `url("${escaped}")`;
};

const loadImageSource = async (file: File): Promise<CanvasImageSource & { width: number; height: number }> => {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return bitmap;
    } catch {
      // iOS HEIC and some gallery files fail here; fall back to Image.
    }
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Не удалось прочитать изображение'));
    };
    image.src = objectUrl;
  });
};

const canvasToJpegDataUrl = (canvas: HTMLCanvasElement, quality: number): Promise<string> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Не удалось обработать изображение'));
          return;
        }
        if (blob.size > MAX_OUTPUT_BYTES) {
          reject(new Error('Файл слишком большой. Выберите фото меньшего размера'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const result = typeof reader.result === 'string' ? reader.result : '';
          if (!result.startsWith('data:image/')) {
            reject(new Error('Не удалось прочитать изображение'));
            return;
          }
          resolve(result);
        };
        reader.onerror = () => reject(new Error('Не удалось прочитать изображение'));
        reader.readAsDataURL(blob);
      },
      'image/jpeg',
      quality
    );
  });

export const fileToImageDataUrl = async (file: File): Promise<string> => {
  if (file.type && !file.type.startsWith('image/') && file.type !== 'application/octet-stream') {
    throw new Error('Можно выбрать только файл изображения');
  }

  const source = await loadImageSource(file);
  const sourceWidth = 'naturalWidth' in source && source.naturalWidth ? source.naturalWidth : source.width;
  const sourceHeight = 'naturalHeight' in source && source.naturalHeight ? source.naturalHeight : source.height;
  if (!sourceWidth || !sourceHeight) {
    throw new Error('Не удалось прочитать изображение');
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Не удалось обработать изображение');
  }
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  if ('close' in source && typeof source.close === 'function') {
    source.close();
  }

  try {
    return await canvasToJpegDataUrl(canvas, JPEG_QUALITY);
  } catch (error) {
    const smaller = document.createElement('canvas');
    smaller.width = Math.max(1, Math.round(width * 0.5));
    smaller.height = Math.max(1, Math.round(height * 0.5));
    const smallerContext = smaller.getContext('2d');
    if (!smallerContext) throw error;
    smallerContext.drawImage(canvas, 0, 0, smaller.width, smaller.height);
    return canvasToJpegDataUrl(smaller, 0.7);
  }
};
