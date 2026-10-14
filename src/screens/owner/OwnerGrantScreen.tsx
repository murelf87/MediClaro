/**
 * /owner/grant[?user=…][&bono=…] — Conceder Premium a usuario (pantalla 5 del diseño).
 * Buscador «Buscar usuario por nombre o teléfono…», lista de personas con su plan y «Conceder Premium». Al elegir a
 * alguien se elige cuánto tiempo (días o un bono). También se puede dar a un teléfono que aún no tiene cuenta.
 * Es Premium de regalo: se suma al que ya tenga (se queda la fecha más lejana) y se puede retirar desde su ficha.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { AppText, EmptyState, ErrorState, SkeletonList } from '../../components';
import { useAppTheme, useAsync } from '../../hooks';
import { OwnerAdminService, type OwnerBono, type OwnerGrantResult, type OwnerUser } from '../../services/OwnerAdminService';
import { confirmAsync } from '../../utils/dialogs';
import { toAppError } from '../../api/errors';
import { MAX_FONT_SIZE_MULTIPLIER } from '../../theme';
import { OButton, OC, OCard, OChips, OLink, ONote, ORadioCard, OSearch, OSegments, OT, OwnerScreen, UserRow, bonoDays, bonoSubtitle, fmtDate } from './OwnerKit';

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}
const isId = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const DAY_CHIPS: { value: string; label: string }[] = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: '365', label: '1 año' },
  { value: 'life', label: 'Vitalicio' },
];

export default function OwnerGrantScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ user?: string | string[]; bono?: string | string[] }>();
  const presetUser = first(params.user);
  const presetBono = first(params.bono);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [byPhone, setByPhone] = useState(false);
  const [phone, setPhone] = useState('');
  const [selected, setSelected] = useState<OwnerUser | null>(null);
  const [how, setHow] = useState<'days' | 'bono'>(isId(presetBono) ? 'bono' : 'days');
  const [bonoId, setBonoId] = useState<string | null>(isId(presetBono) ? presetBono : null);
  const [days, setDays] = useState('30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<OwnerGrantResult | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const people = useAsync(() => OwnerAdminService.users({ q: debounced, page: 0 }), [debounced], { enabled: !byPhone });
  const bonos = useAsync(() => OwnerAdminService.bonos({ state: 'active' }), []);
  const preset = useAsync(() => OwnerAdminService.user(presetUser), [presetUser], { enabled: isId(presetUser) });
  useEffect(() => {
    if (preset.data?.user) setSelected(preset.data.user);
  }, [preset.data]);

  const activeBonos: OwnerBono[] = bonos.data?.items ?? [];
  const chosenBono = activeBonos.find((b) => b.id === bonoId) ?? null;
  const dayValue: number | null = days === 'life' ? null : Number(days);
  const who = byPhone ? (phone.trim() ? phone.trim() : null) : selected ? selected.name ?? 'esta persona' : null;
  const span = (d: number | null) => (d === null ? 'para siempre (vitalicio)' : `durante ${bonoDays(d)}`);
  const durationText = how === 'bono' ? (chosenBono ? `${span(chosenBono.days)} con el bono «${chosenBono.name}»` : null) : span(dayValue);
  const canSubmit = !busy && !!who && !!durationText && (byPhone || (selected?.verified ?? false));

  const submit = async () => {
    if (!canSubmit || lock.current) return;
    const ok = await confirmAsync({
      title: 'Conceder Premium',
      message: `¿Dar MediClaro Premium a ${who} ${durationText}? Si ya tenía Premium de regalo, se queda la fecha más lejana.`,
      confirmText: 'Conceder',
    });
    if (!ok) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const target = byPhone ? { phone: phone.trim() } : { userId: selected?.id ?? '' };
      const result = await OwnerAdminService.grant(target, how === 'bono' && chosenBono ? { bonoId: chosenBono.id } : { days: dayValue });
      setDone(result);
      void bonos.refresh();
      void people.refresh();
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  if (done) {
    const name = done.user?.name ?? done.phone ?? 'La persona';
    return (
      <OwnerScreen title="Premium concedido" testID="owner-grant">
        <ONote tone="green">
          {`${name} tiene MediClaro Premium ${done.lifetime ? 'sin fecha de fin' : `hasta el ${fmtDate(done.expiresAt)}`}.${done.verified ? '' : ' Se activará cuando entre en MediClaro con ese teléfono.'}`}
        </ONote>
        {done.bono ? <AppText style={OT.cardText} color="textSecondary">{`Bono «${done.bono.name}»: usado ${done.bono.uses} de ${done.bono.maxUses}.`}</AppText> : null}
        {done.user ? (
          <OButton label="Ver su ficha" onPress={() => router.replace({ pathname: '/owner/user', params: { id: done.user?.id ?? '' } } as Href)} />
        ) : null}
        <OButton
          label="Dar Premium a otra persona"
          variant="outline"
          onPress={() => {
            setDone(null);
            setSelected(null);
            setPhone('');
            setQuery('');
          }}
        />
      </OwnerScreen>
    );
  }

  return (
    <OwnerScreen
      title="Conceder Premium a usuario"
      subtitle="Selecciona un usuario y asigna el acceso Premium durante el tiempo que desees."
      keyboard
      testID="owner-grant"
      footer={<OButton label="Conceder Premium" onPress={() => void submit()} loading={busy} disabled={!canSubmit} testID="owner-grant-submit" />}
    >
      {byPhone ? (
        <OCard style={styles.phoneCard}>
          <AppText style={OT.label} color="heading">Teléfono de la persona</AppText>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={32}
            placeholder="600 123 456"
            placeholderTextColor="#94A3B8"
            accessibilityLabel="Teléfono de la persona"
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            testID="owner-grant-phone"
            style={[styles.phoneInput, { color: theme.colors.text }]}
          />
          <AppText style={OT.meta} color="textSecondary">España: 9 cifras. Otro país: con su prefijo (+351…).</AppText>
        </OCard>
      ) : (
        <OSearch value={query} onChangeText={setQuery} placeholder="Buscar usuario por nombre o teléfono..." testID="owner-grant-search" />
      )}
      <OLink
        label={byPhone ? 'Buscar entre los usuarios' : '¿No está en la lista? Dar por teléfono'}
        onPress={() => {
          setByPhone((v) => !v);
          setSelected(null);
        }}
        testID="owner-grant-mode"
      />

      {!byPhone ? (
        <>
          {people.status === 'loading' ? <SkeletonList rows={3} /> : null}
          {people.error && !people.data ? <ErrorState kind={people.error.kind} message={people.error.message} onRetry={() => void people.reload()} /> : null}
          {people.data && !people.data.items.length ? (
            <EmptyState icon="search-outline" title="No hay nadie con ese nombre o teléfono" message="Prueba con otra parte del nombre o dale el Premium por su teléfono." />
          ) : null}
          {selected && !people.data?.items.some((u) => u.id === selected.id) ? (
            <UserRow user={selected} selected onPress={() => setSelected(null)} testID="owner-grant-selected" />
          ) : null}
          {people.data?.items.slice(0, 8).map((u) => (
            <UserRow
              key={u.id}
              user={u}
              selected={selected?.id === u.id}
              onPress={() => setSelected(selected?.id === u.id ? null : u)}
              testID={`owner-grant-user-${u.id}`}
            />
          ))}
          {people.data && people.data.total > 8 ? (
            <AppText style={OT.meta} color="textSecondary" align="center">{`Y ${people.data.total - 8} más: escribe parte del nombre o del teléfono.`}</AppText>
          ) : null}
          {selected && !selected.verified ? (
            <ONote tone="amber">Esta persona aún no ha entrado con su teléfono: dale el Premium por su número («Dar por teléfono»).</ONote>
          ) : null}
        </>
      ) : null}

      {who ? (
        <OCard style={{ gap: 12 }} testID="owner-grant-duration">
          <AppText style={OT.cardTitle} color="heading">{`Premium para ${who}`}</AppText>
          <OSegments
            options={[
              { value: 'days', label: 'Elegir días' },
              { value: 'bono', label: 'Con un bono' },
            ]}
            value={how}
            onChange={setHow}
            accessibilityLabel="Cómo dar el Premium"
          />
          {how === 'days' ? (
            <OChips options={DAY_CHIPS} value={days} onChange={setDays} />
          ) : bonos.status === 'loading' ? (
            <SkeletonList rows={2} />
          ) : activeBonos.length ? (
            <ORadioCard
              title="Bono"
              options={activeBonos.map((b) => ({ value: b.id, label: b.name, description: `${bonoSubtitle(b)} · quedan ${b.maxUses - b.uses} de ${b.maxUses}` }))}
              value={bonoId ?? ''}
              onChange={(v) => setBonoId(v || null)}
              testIDPrefix="owner-grant-bono"
            />
          ) : (
            <View style={{ gap: 4 }}>
              <AppText style={OT.cardText} color="textSecondary">No tienes bonos activos.</AppText>
              <OLink label="Crear un bono" onPress={() => router.push('/owner/voucher-new' as Href)} />
            </View>
          )}
        </OCard>
      ) : null}

      {error ? <ONote tone="amber" testID="owner-grant-error">{error}</ONote> : null}
      <AppText style={OT.meta} color="textSecondary">Es un regalo tuyo: no se cobra nada y la persona no tiene que escribir ningún código. Queda anotado en el registro.</AppText>
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  phoneCard: { gap: 6 },
  phoneInput: { fontSize: 18, minHeight: 46, borderWidth: 1, borderColor: OC.line, borderRadius: 10, paddingHorizontal: 12 },
});
