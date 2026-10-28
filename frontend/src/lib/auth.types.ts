/**
 * Información pública de un participante.
 *
 * Coincide con los datos devueltos por el backend
 * durante el registro, inicio de sesión y consulta
 * de la sesión actual.
 */
export interface Participante {
  id: string;
  full_name: string;
  email: string;
}

/**
 * Datos enviados a POST /api/auth/register.
 */
export interface RegistroParticipante {
  full_name: string;
  email: string;
  password: string;
  accepted_terms: boolean;
  accepted_privacy: boolean;
}

/**
 * Datos enviados a POST /api/auth/login.
 */
export interface CredencialesLogin {
  email: string;
  password: string;
}

/**
 * Estructura general de una respuesta exitosa
 * de la API.
 */
export interface RespuestaAPI<T> {
  success: true;
  message?: string;
  data: T;
}

/**
 * Respuesta de POST /api/auth/register.
 */
export type RespuestaRegistro = RespuestaAPI<{
  participant: Participante;
}>;

/**
 * Respuesta de POST /api/auth/login.
 *
 * El backend crea una sesión y establece
 * una cookie HttpOnly.
 */
export type RespuestaLogin = RespuestaAPI<{
  participant: Participante;
  expiresAt: string;
}>;

/**
 * Respuesta de GET /api/auth/me.
 *
 * Cuando no existe una sesión válida,
 * el backend responde con HTTP 401.
 */
export type RespuestaSesion = RespuestaAPI<{
  participant: Participante;
}>;

/**
 * Respuesta de POST /api/auth/logout.
 *
 * Este endpoint no devuelve la propiedad data.
 */
export interface RespuestaLogout {
  success: true;
  message: string;
}

/**
 * Respuesta de error de la API.
 */
export interface RespuestaError {
  success: false;
  message: string;
}