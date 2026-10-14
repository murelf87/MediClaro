/**
 * /owner/voice — «Voz de la app» (Configuración): la voz que oyen TODAS las personas.
 *  - Voz natural (Sulafat y Achird, de Google). Si no llega (sin internet o por el límite de Google), se lee con la
 *    mejor voz en español de cada móvil, sin quedarse nunca en silencio.
 *  - Voz del teléfono: gratis y sin límites. Cada móvil usa la mejor voz en español que tenga (nunca una fija), así
 *    que suena distinta en cada uno.
 * Se guarda en el servidor (queda en el registro) y llega a cada móvil al abrir la app o en unos minutos.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ErrorState, SkeletonList } from '../../components';
import { useAsync } from '../../hooks';
import { OwnerAdminService, type VoiceBudget } from '../../services/OwnerAdminService';
import type { VoiceMode } from '../../services/VoiceSettings';
import { toAppError } from '../../api/errors';
import { OButton, OChips, ONote, ORadioCard, OSection, OwnerScreen } from './OwnerKit';
import { sayOnDevice, testNaturalVoice, type CheckResult } from './reviewChecks';

const OPTIONS: { value: VoiceMode; label: string; description: string }[] = [
  {
    value: 'natural',
    label: 'Voz natural (Sulafat y Achird)',
    description:
      'La de Google, la más natural. Si no llega (sin internet o por el límite de Google), se lee con la mejor voz de cada móvil.',
  },
  {
    value: 'device',
    label: 'Voz del teléfono',
    description:
      'Gratis y sin límites. Cada móvil usa la mejor voz en español que tenga instalada, así que suena distinta en cada uno.',
  },
];

/** Topes que se ofrecen (dólares al mes). 0 = voz natural apagada. */
export const BUDGET_CHOICES = [0, 10, 20, 25, 30, 50];
const BUDGET_OPTIONS = BUDGET_CHOICES.map((n) => ({ value: String(n), label: n === 0 ? 'Apagada' : `${n} $` }));

export function budgetText(b: VoiceBudget): string {
  return `Este mes (${b.month || 'en curso'}): ${b.spentUsd.toFixed(2).replace('.', ',')} $ gastados (estimado) de ${b.limitUsd} $.`;
}

export const VOICE_MODE_LABEL: Record<VoiceMode, string> = { natural: 'Voz natural', device: 'Voz del teléfono' };

export default function OwnerVoiceScreen() {
  const data = useAsync(() => OwnerAdminService.voiceMode(), []);
  const [mode, setMode] = useState<VoiceMode>('natural');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ tone: 'green' | 'amber'; text: string } | null>(null);
  const loaded = useRef(false);
  const budget = useAsync(() => OwnerAdminService.voiceBudget(), []);
  const [limit, setLimit] = useState('25');
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetResult, setBudgetResult] = useState<{ tone: 'green' | 'amber'; text: string } | null>(null);
  const budgetLoaded = useRef(false);

  useEffect(() => {
    if (budgetLoaded.current || budget.status !== 'success' || !budget.data) return;
    budgetLoaded.current = true;
    setLimit(String(budget.data.limitUsd));
  }, [budget.data, budget.status]);

  const saveBudget = async () => {
    if (savingBudget) return;
    setSavingBudget(true);
    setBudgetResult(null);
    try {
      const saved = await OwnerAdminService.setVoiceBudget(Number(limit));
      budget.setData(saved);
      setBudgetResult({
        tone: 'green',
        text:
          saved.limitUsd === 0
            ? 'Guardado: voz natural apagada, todas las personas oirán la voz del teléfono.'
            : `Guardado: tope de ${saved.limitUsd} $ al mes. Al llegar, la app lee con la voz del teléfono hasta el mes siguiente.`,
      });
    } catch (e) {
      setBudgetResult({ tone: 'amber', text: toAppError(e).message });
    } finally {
      setSavingBudget(false);
    }
  };

  useEffect(() => {
    if (loaded.current || data.status !== 'success' || !data.data) return;
    loaded.current = true;
    setMode(data.data);
  }, [data.data, data.status]);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const saved = await OwnerAdminService.setVoiceMode(mode);
      data.setData(saved);
      setResult({
        tone: 'green',
        text: `Guardado: ${VOICE_MODE_LABEL[saved].toLowerCase()} para todas las personas. En tu móvil ya está; en los demás, al abrir la app o en unos minutos.`,
      });
    } catch (e) {
      setResult({ tone: 'amber', text: toAppError(e).message });
    } finally {
      setBusy(false);
    }
  };

  const listenNatural = async () => {
    if (testing) return;
    setTesting(true);
    setResult(null);
    try {
      const r: CheckResult = await testNaturalVoice('Sulafat');
      if (r.state === 'fail') setResult({ tone: 'amber', text: r.detail });
    } finally {
      setTesting(false);
    }
  };

  const saved = data.data;
  const changed = !!saved && saved !== mode;

  return (
    <OwnerScreen
      title="Voz de la app"
      subtitle="La voz con la que MediClaro lee y habla a todas las personas."
      testID="owner-voice"
      footer={
        <OButton
          label="Guardar"
          icon="checkmark-circle-outline"
          onPress={() => void save()}
          loading={busy}
          disabled={busy || data.status !== 'success' || !changed}
          testID="owner-voice-save"
        />
      }
    >
      {data.status === 'loading' ? (
        <SkeletonList rows={2} />
      ) : data.status === 'error' ? (
        <ErrorState message={toAppError(data.error).message} onRetry={() => void data.refresh()} />
      ) : (
        <>
          <ORadioCard title="Para todas las personas" options={OPTIONS} value={mode} onChange={setMode} testIDPrefix="owner-voice" />
          {saved ? <ONote>Ahora mismo: {VOICE_MODE_LABEL[saved].toLowerCase()}.</ONote> : null}
          {result ? <ONote tone={result.tone}>{result.text}</ONote> : null}

          <OSection title="Tope de gasto de la voz natural" />
          {budget.status === 'success' && budget.data ? (
            <>
              <ONote testID="owner-voice-budget-spent">{budgetText(budget.data)}</ONote>
              <OChips options={BUDGET_OPTIONS} value={limit} onChange={setLimit} fill />
              <OButton
                label="Guardar el tope"
                icon="speedometer-outline"
                variant="outline"
                onPress={() => void saveBudget()}
                loading={savingBudget}
                disabled={savingBudget || Number(limit) === budget.data.limitUsd}
                testID="owner-voice-budget-save"
              />
              {budget.data.blocked > 0 ? (
                <ONote tone="amber">
                  Este mes se ha leído {budget.data.blocked} {budget.data.blocked === 1 ? 'vez' : 'veces'} con la voz del teléfono por llegar al tope.
                </ONote>
              ) : null}
              {budgetResult ? <ONote tone={budgetResult.tone}>{budgetResult.text}</ONote> : null}
            </>
          ) : budget.status === 'error' ? (
            <ONote tone="amber">
              {budget.error ? 'El tope de gasto todavía no está activado en el servidor (falta aplicar su migración).' : ''}
            </ONote>
          ) : null}
          <ONote>
            El gasto es una estimación por caracteres: Google factura por uso, así que pon el tope algo por debajo de lo que quieras gastar.
            Cada mes empieza de cero.
          </ONote>

          <OSection title="Escuchar en este móvil" />
          <View style={styles.actions}>
            <OButton
              label="Voz natural"
              icon="volume-high"
              variant="outline"
              onPress={() => void listenNatural()}
              loading={testing}
              disabled={testing}
              style={styles.half}
              testID="owner-voice-listen-natural"
            />
            <OButton
              label="Voz del teléfono"
              icon="volume-medium"
              variant="outline"
              onPress={sayOnDevice}
              style={styles.half}
              testID="owner-voice-listen-device"
            />
          </View>
          <ONote>
            La voz del teléfono suena mejor si el móvil tiene una voz «Premium» o «Mejorada» en español. En iPhone: Ajustes ›
            Accesibilidad › Leer y hablar › Voces › Español (España).
          </ONote>
        </>
      )}
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
});
