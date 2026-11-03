import { env } from "../config/env.js";

type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

export type ConvertResult = {
  buffer: Buffer;
  contentType: string;
  filename: string;
};

export function fenecwebpConvertConfigured(): boolean {
  return env.fenecwebpEnabled && Boolean(env.fenecwebpApiKey);
}

/** POST /convert — multipart field `file`. */
export async function convertToWebp(input: {
  buffer: Buffer;
  filename: string;
  mime: string;
}): Promise<ConvertResult> {
  if (!env.fenecwebpApiKey) throw new Error("Falta FENECWEBP_API_KEY.");
  const base = env.fenecwebpBaseUrl || "https://webp.fenecstudio.com";

  const form = new FormData();
  const blob = new Blob([new Uint8Array(input.buffer)], {
    type: input.mime || "application/octet-stream",
  });
  form.append("file", blob, input.filename || "image.bin");
  form.append("format", "webp");

  const res = await fetch(`${base}/convert`, {
    method: "POST",
    headers: { "X-API-Key": env.fenecwebpApiKey },
    body: form,
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as ApiEnvelope<unknown> | null;
    throw new Error(
      errBody?.error?.message || `FenecWebP convert HTTP ${res.status}`
    );
  }

  const ab = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "image/webp";
  const baseName = input.filename.replace(/\.[^.]+$/, "") || "image";
  return {
    buffer: Buffer.from(ab),
    contentType,
    filename: `${baseName}.webp`,
  };
}
