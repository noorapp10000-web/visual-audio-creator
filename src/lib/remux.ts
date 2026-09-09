import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
} from "mediabunny";

/**
 * تسجيل الكانفس (MediaRecorder) يخرج ملف بدون بيانات المدة الصحيحة،
 * فبعض المعارض/المنصات تقرأ مدة خاطئة (٤ ثواني مثلًا).
 * هنا نعيد تغليف الملف داخل حاوية MP4 صحيحة مع كتابة المدة الحقيقية.
 */
export async function fixDurationToMp4(
  blob: Blob,
  onProgress?: (p: number) => void,
): Promise<{ blob: Blob; ext: string }> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const conversion = await Conversion.init({ input, output });
  if (onProgress) conversion.onProgress = (p) => onProgress(p);
  await conversion.execute();
  const buffer = output.target.buffer;
  if (!buffer) throw new Error("remux failed");
  return { blob: new Blob([buffer], { type: "video/mp4" }), ext: "mp4" };
}
