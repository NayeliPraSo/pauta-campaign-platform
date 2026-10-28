import { apiFetch } from "./api";
import type {
  RespuestaLogout,
  RespuestaSesion,
} from "./auth.types";

/**
 * Consulta al backend para obtener
 * el participante autenticado.
 */
export async function obtenerSesion(): Promise<RespuestaSesion> {
  return apiFetch<RespuestaSesion>("/api/auth/me", {
    method: "GET",
  });
}

/**
 * Cierra la sesión actual.
 *
 * El backend revoca la sesión en PostgreSQL
 * y elimina la cookie de autenticación.
 */
export async function cerrarSesion(): Promise<RespuestaLogout> {
  return apiFetch<RespuestaLogout>("/api/auth/logout", {
    method: "POST",
  });
}