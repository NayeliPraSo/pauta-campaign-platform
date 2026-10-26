export interface Participante {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
  email: string;
}

export interface RegistroParticipante {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  email: string;
  password: string;
  aceptaTerminos: boolean;
  aceptaPrivacidad: boolean;
}

export interface CredencialesLogin {
  email: string;
  password: string;
}

export interface RespuestaAutenticacion {
  success: boolean;
  message?: string;
  participante?: Participante;
}

export interface RespuestaSesion {
  authenticated: boolean;
  participante?: Participante;
}