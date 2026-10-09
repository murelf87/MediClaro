/** Ruta antigua del panel: ahora el panel empieza en el acceso privado (/owner). */
import { Redirect, type Href } from 'expo-router';

export default function OwnerDashboardRedirect() {
  return <Redirect href={'/owner' as Href} />;
}
