// 업로드 전 사진 줄이기 — 폰 카메라 사진(4~10MB)을 긴 변 maxSide px JPEG로
// Cloudflare Tunnel로 폰에서 올릴 때 속도·서버 저장 용량 절약 (서버 한도 10MB)
// GIF(움짤)·이미 작은 파일은 그대로, 브라우저가 못 읽는 형식(HEIC 등)도 원본 그대로 보내서 서버가 판단
export const shrinkImage = async (file: File, maxSide = 1920, quality = 0.85): Promise<File> => {
  if (file.type === 'image/gif') return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file); // EXIF 회전은 브라우저 기본값(from-image)으로 반영됨
  } catch {
    return file;
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1024 * 1024) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) { bitmap.close(); return file; }
  // PNG 투명 배경이 JPEG에서 검게 변하지 않도록 흰 배경
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
};
