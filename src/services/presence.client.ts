import { env } from "../config/env.js";

export function presenceConfigured(): boolean {
  return (
    env.fenecPresenceEnabled &&
    Boolean(env.fenecPresenceIngestUrl) &&
    Boolean(env.fenecPresenceSecret) &&
    Boolean(env.fenecInstanceSlug)
  );
}

/** Forward best-effort al Admin (no lanza si falla). */
export async function pingPresenceToAdmin(input: {
  actorKey: string;
  displayName: string;
  role?: string | null;
  path?: string | null;
  email?: string | null;
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
