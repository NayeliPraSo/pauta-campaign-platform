import { ApiError } from "./api";
import { obtenerSesion } from "./auth";

/**
 * Redirige al dashboard cuando existe
 * una sesión autenticada.
 *
 * Retorna true si se inició la redirección.
 */
export async function redirectIfAuthenticated(): Promise<boolean> {
  try {
    await obtenerSesion();

    window.location.replace("/dashboard");

    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return false;
    }

    // Si falla la conexión, no asumimos que
    // el participante carece de sesión.
    throw error;
  }
}