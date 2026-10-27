import { randomBytes } from "node:crypto";

export function nextId(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

export function slugCodigo(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "lista";
}
