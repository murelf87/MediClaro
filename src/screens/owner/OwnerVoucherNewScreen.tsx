/**
 * /owner/voucher-new — Crear bono gratuito (pantalla 4 del diseño): tipo de bono (Premium completo o Premium familiar),
 * duración (7 días, 30 días, 90 días, 1 año o vitalicio) y cantidad de bonos (cuántas personas pueden recibirlo).
 * El nombre se pone solo («Bono 30 días», «Bono familiar 90 días»…).
 * MediClaro tiene un solo Premium: «familiar» es el mismo Premium para varias personas de una familia (un bono por
 * persona), por eso pide al menos 2.
 */
import { useRef, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { AppText } from '../../components';
import { OwnerAdminService } from '../../services/OwnerAdminService';
import { toAppError } from '../../api/errors';
import { OButton, OCard, ONote, ORadioCard, OStepper, OT, OwnerScreen, autoBonoName, type BonoKind } from './OwnerKit';

const DAYS: { value: number | null; label: string }[] = [
  { value: 7, label: '7 días' },
  { value: 30, label: '30 días' },
  { value: 90, label: '90 días' },
  { value: 365, label: '1 año' },
  { value: null, label: 'Vitalicio' },
];

const KINDS: { value: BonoKind; label: string }[] = [
  { value: 'full', label: 'Premium completo' },
  { value: 'family', label: 'Premium familiar' },
];

export default function OwnerVoucherNewScreen() {
  const router = useRouter();
  const [kind, setKind] = useState<BonoKind>('full');
  const [days, setDays] = useState<number | null>(30);
  const [uses, setUses] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);

  const chooseKind = (k: BonoKind) => {
    setKind(k);
    if (k === 'family' && uses < 2) setUses(3);
  };

  const create = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const bono = await OwnerAdminService.bonoCreate({ name: autoBonoName(kind, days), days, maxUses: uses });
      router.replace({ pathname: '/owner/voucher', params: { id: bono.id, created: '1' } } as Href);
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <OwnerScreen title="Crear bono gratuito" subtitle="Configura el tipo de bono y su duración." testID="owner-voucher-new">
      <ORadioCard title="Tipo de bono" options={KINDS} value={kind} onChange={chooseKind} testIDPrefix="owner-voucher-type" />
      <ORadioCard title="Duración" options={DAYS} value={days} onChange={setDays} testIDPrefix="owner-voucher-days" />
      <OCard style={{ gap: 10 }}>
        <AppText style={OT.cardTitle} color="heading">Cantidad de bonos</AppText>
        <OStepper value={uses} onChange={setUses} min={kind === 'family' ? 2 : 1} testID="owner-voucher-uses" />
        <AppText style={OT.cardText} color="textSecondary">
          {kind === 'family' ? 'Uno por cada persona de la familia, con el mismo Premium.' : 'Uno por persona: puedes dárselo a quien quieras desde el panel.'}
        </AppText>
      </OCard>
      {error ? <ONote tone="amber" testID="owner-voucher-error">{error}</ONote> : null}
      <OButton label="Generar bono" onPress={() => void create()} loading={busy} disabled={busy} testID="owner-voucher-submit" />
    </OwnerScreen>
  );
}
