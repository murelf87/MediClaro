/**
 * /subscribe — enlace heredado. La URL de vuelta por defecto del backend es
 * mediclaro://subscribe?ok=1|cancel=1: se reenvía a /payment-result con los mismos
 * parámetros. Sin parámetros, abre Premium.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function SubscribeScreen() {
  const params = useLocalSearchParams<{ ok?: string | string[]; cancel?: string | string[] }>();
  const ok = firstParam(params.ok);
  const cancel = firstParam(params.cancel);
  if (ok || cancel) {
    const forward: Record<string, string> = {};
    if (ok) forward.ok = ok;
    if (cancel) forward.cancel = cancel;
    return <Redirect href={{ pathname: '/payment-result', params: forward }} />;
  }
  return <Redirect href="/premium" />;
}
