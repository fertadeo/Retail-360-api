import { env } from "../config/env.js";

export function presenceConfigured(): boolean {
  return (
    env.fenecPresenceEnabled &&
    Boolean(env.fenecPresenceIngestUrl) &&
    Boolean(env.fenecPresenceSecret) &&
    Boolean(env.fenecInstanceSlug)
  );
}

export function readClientIp(req: {
  headers: Record<string, unknown>;
  socket?: { remoteAddress?: string };
  ip?: string;
}): string | null {
  const xf = req.headers["x-forwarded-for"] ?? req.headers["X-Forwarded-For"];
  if (typeof xf === "string" && xf.trim()) {
    return xf.split(",")[0]!.trim().replace(/^::ffff:/, "") || null;
  }
  if (Array.isArray(xf) && typeof xf[0] === "string") {
    return xf[0].split(",")[0]!.trim().replace(/^::ffff:/, "") || null;
  }
  const raw = (req.ip || req.socket?.remoteAddress || "").trim();
  return raw.replace(/^::ffff:/, "") || null;
}

/** Forward best-effort al Admin (no lanza si falla). */
export async function pingPresenceToAdmin(input: {
  actorKey: string;
  displayName: string;
  role?: string | null;
  path?: string | null;
  email?: string | null;
  clientIp?: string | null;
}): Promise<{ ok: boolean; detail?: string }> {
  if (!presenceConfigured()) {
    return { ok: false, detail: "Presencia no configurada." };
  }
  try {
    const res = await fetch(env.fenecPresenceIngestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fenec-Presence-Secret": env.fenecPresenceSecret,
      },
      body: JSON.stringify({
        slug: env.fenecInstanceSlug,
        actorKey: input.actorKey,
        displayName: input.displayName,
        role: input.role ?? null,
        path: input.path ?? null,
        email: input.email ?? null,
        clientIp: input.clientIp ?? null,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      return {
        ok: false,
        detail: body?.error || `HTTP ${res.status}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "ingest falló",
    };
  }
}
