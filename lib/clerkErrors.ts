import { isClerkAPIResponseError } from '@clerk/clerk-expo';

// Mensajes de Clerk en español para los errores más comunes.
const MESSAGES: Record<string, string> = {
  form_identifier_not_found: 'No existe una cuenta con ese correo. Regístrate primero.',
  form_password_incorrect: 'Contraseña incorrecta.',
  form_identifier_exists: 'Ya existe una cuenta con ese correo. Inicia sesión.',
  form_password_pwned: 'Esa contraseña apareció en filtraciones de datos. Usa otra.',
  form_password_length_too_short: 'La contraseña es muy corta (mínimo 8 caracteres).',
  form_password_validation_failed: 'La contraseña no cumple los requisitos.',
  form_param_format_invalid: 'El correo no tiene un formato válido.',
  form_code_incorrect: 'El código es incorrecto.',
  verification_expired: 'El código expiró. Pide uno nuevo.',
  too_many_requests: 'Demasiados intentos. Espera un momento.',
  session_exists: 'Ya hay una sesión iniciada.',
  oauth_access_denied: 'Cancelaste el inicio con Google.',
};

export function clerkErrorMessage(error: unknown, fallback = 'Ocurrió un error. Intenta de nuevo.') {
  if (isClerkAPIResponseError(error)) {
    const first = error.errors?.[0];
    if (first) {
      return MESSAGES[first.code] || first.longMessage || first.message || fallback;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
