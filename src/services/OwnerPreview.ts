/**
 * «Ver la app como…» — vista previa del propietario (panel → Revisar la app).
 *
 * Permite a los propietarios recorrer la app tal como la ve cada tipo de persona, para revisar si algo falla:
 *  - 'visitor'   sin cuenta (la entrada, «Conocer MediClaro», «Ya soy Premium», los planes);
 *  - 'free'      Básico gratuito (lo que está bloqueado y cómo se ofrece Premium);
 *  - 'premium'   Premium (todo desbloqueado);
 *  - 'caregiver' cuidador/a gratuito (su pantalla y el simulacro de un aviso como lo recibe).
 *
 * Es SOLO visual y SOLO en este teléfono: no cambia nada en el servidor ni en la cuenta. El servidor sigue aplicando
 * los permisos reales de la cuenta del propietario. No se guarda: al cerrar la app o la sesión, desaparece.
 */
export type PreviewRole = 'visitor' | 'free' | 'premium' | 'caregiver';

export const PREVIEW_LABEL: Record<PreviewRole, string> = {
  visitor: 'Sin cuenta',
  free: 'Básico (gratis)',
  premium: 'Premium',
  caregiver: 'Cuidador/a',
};

let current: PreviewRole | null = null;
let version = 0;
const listeners = new Set<() => void>();

function emit(): void {
  version += 1;
  listeners.forEach((l) => l());
}

export const OwnerPreview = {
  get(): PreviewRole | null {
    return current;
  },
  isActive(): boolean {
    return current !== null;
  },
  set(role: PreviewRole): void {
    if (current === role) return;
    current = role;
    emit();
  },
  clear(): void {
    if (current === null) return;
    current = null;
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  snapshot(): number {
    return version;
  },
  /** ¿Se ve como Premium? null = sin vista previa (se usa lo real). */
  premiumOverride(): boolean | null {
    if (current === null) return null;
    return current === 'premium';
  },
  /** ¿La pantalla debe enseñarse como cuidador/a? null = sin vista previa (se usa lo real). */
  caregiverOverride(): boolean | null {
    if (current === null) return null;
    return current === 'caregiver';
  },
};

/*
 * Lo que ENSEÑAN las pantallas durante la vista previa. Solo lo leen las pantallas (useSession / useEntitlement);
 * los procesos de fondo (avisos de pastillas, cuidador, llamadas) y las comprobaciones de pago siguen usando lo real
 * (useRealSession / useRealEntitlement), para que la vista previa no cancele avisos ni cambie nada de verdad.
 */
type SessionLike = { mode: string; phone: string | null };

export function previewSession<V extends { status: string; session: SessionLike | null }>(value: V, role: PreviewRole | null): V {
  if (role === null || role === 'premium') return value;
  if (role === 'visitor') {
    // Sin cuenta: la app se comporta como si no hubiera sesión (solo las pantallas públicas).
    return { ...value, status: value.status === 'loading' ? 'loading' : 'signedOut', session: null } as V;
  }
  // Básico y cuidador/a entran sin teléfono (el teléfono solo se registra al pagar Premium).
  if (!value.session) return value;
  return { ...value, session: { ...value.session, mode: 'anonymous', phone: null } } as V;
}

type EntitlementLike = { status: string; subscription: unknown; isPremium: boolean; required: boolean; unlocked: boolean };

export function previewEntitlement<V extends EntitlementLike>(value: V, role: PreviewRole | null): V {
  if (role === null) return value;
  if (role === 'premium') return { ...value, isPremium: true, unlocked: true } as V;
  return { ...value, status: 'ready', subscription: null, isPremium: false, unlocked: !value.required } as V;
}
