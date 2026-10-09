/**
 * Destino después de entrar con el teléfono.
 * Por defecto se va al Inicio; si la persona venía de contratar Premium (p. ej. el servidor no permite
 * cuentas sin teléfono y ha tenido que entrar antes de pagar), se vuelve a la pantalla de pago.
 */
let pending: string | null = null;

export const PostAuthRoute = {
  set(path: string): void {
    pending = path;
  },
  /** Devuelve el destino pendiente y lo olvida. */
  consume(): string | null {
    const value = pending;
    pending = null;
    return value;
  },
  peek(): string | null {
    return pending;
  },
  clear(): void {
    pending = null;
  },
};
