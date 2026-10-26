import { TranscriptionError, transcribeAudio } from "@/lib/transcription";

export const maxDuration = 60;

// Leave headroom below Vercel Functions' 4.5 MiB request cap for multipart
// boundaries and headers. This same limit is used for uploads and recordings.
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_AUDIO_BYTES + 64 * 1024;

const AUDIO_TYPES_BY_EXTENSION: Record<string, string> = {
  aac: "audio/aac",
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  mp4: "audio/mp4",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  webm: "audio/webm",
};

class RequestTooLargeError extends Error {}

async function readBoundedBody(request: Request): Promise<Uint8Array> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) {
    throw new RequestTooLargeError();
  }

  if (!request.body) {
    throw new TranscriptionError("Choose an audio recording to transcribe.", 400);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_MULTIPART_BYTES) {
        await reader.cancel();
        throw new RequestTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function canonicalAudioType(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const expectedType = AUDIO_TYPES_BY_EXTENSION[extension];
  if (!expectedType) return null;

  const declaredType = file.type.toLowerCase().split(";")[0];
  const acceptableDeclaredTypes: Record<string, string[]> = {
    "audio/aac": ["audio/aac", "audio/x-aac", "application/octet-stream"],
    "audio/flac": ["audio/flac", "audio/x-flac", "application/octet-stream"],
    "audio/mp4": ["audio/mp4", "audio/x-m4a", "audio/m4a", "video/mp4", "application/octet-stream"],
    "audio/mpeg": ["audio/mpeg", "audio/mp3", "application/octet-stream"],
    "audio/ogg": ["audio/ogg", "application/ogg", "application/octet-stream"],
    "audio/wav": ["audio/wav", "audio/x-wav", "audio/wave", "application/octet-stream"],
    "audio/webm": ["audio/webm", "video/webm", "application/octet-stream"],
  };
  return !declaredType || acceptableDeclaredTypes[expectedType].includes(declaredType)
    ? expectedType
    : null;
}

export async function POST(request: Request) {
  let bytes: Uint8Array;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
      return Response.json(
        { error: "Send the recording as a multipart audio file." },
        { status: 415 },
      );
    }
    bytes = await readBoundedBody(request);
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      return Response.json(
        { error: "The upload is too large. Choose an audio file under 4 MiB." },
        { status: 413 },
      );
    }
    const failure = error instanceof TranscriptionError
      ? error
      : new TranscriptionError("The upload could not be read. Try again.", 400);
    return Response.json({ error: failure.message }, { status: failure.status });
  }

  let file: FormDataEntryValue | null;
  try {
    const boundedBody = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(boundedBody).set(bytes);
    const boundedRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: boundedBody,
    });
    file = (await boundedRequest.formData()).get("file");
  } catch {
    return Response.json(
      { error: "The upload was not a valid audio file. Choose a recording and retry." },
      { status: 400 },
    );
  }

  if (!(file instanceof File)) {
    return Response.json(
      { error: "Choose an audio recording to transcribe." },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return Response.json(
      { error: "The selected audio file is empty." },
      { status: 400 },
    );
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return Response.json(
      { error: "The recording must be 4 MiB or smaller. Choose a shorter or compressed file." },
      { status: 413 },
    );
  }

  const audioType = canonicalAudioType(file);
  if (!audioType) {
    return Response.json(
      { error: "Unsupported audio format. Use MP3, M4A/MP4, WAV, WebM, OGG, FLAC, or AAC." },
      { status: 415 },
    );
  }

  const normalizedFile = new File([await file.arrayBuffer()], file.name, {
    type: audioType,
  });
  try {
    const text = await transcribeAudio(normalizedFile, { signal: request.signal });
    return Response.json({ text }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = error instanceof TranscriptionError
      ? error
      : new TranscriptionError("Transcription failed. Retry the recording.", 502);
    return Response.json(
      { error: failure.message },
      { status: failure.status === 499 ? 499 : failure.status },
    );
  }
}
