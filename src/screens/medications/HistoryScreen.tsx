/**
 * Historial de identificaciones (/history).
 * Uso del mes (plan gratuito), identificaciones agrupadas por día y acceso a la
 * ficha de las que se identificaron. Las no identificadas no son pulsables.
 */
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AppHeader,
  AppText,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  InfoBanner,
  ListGroup,
  Screen,
  SkeletonList,
  TextButton,
  type IconName,
} from '../../components';
import { useAppTheme, useAsync, useEntitlement, useRefreshOnFocus } from '../../hooks';
import { MedicationService, SubscriptionService } from '../../services';
import { FALLBACK_OVERAGE_CENTS } from '../../config/plans';
import { formatPrice, formatRelativeDay, formatTime } from '../../utils/format';
import type { HistoryMethod, HistoryStatus, MedicationHistoryEntry } from '../../types';
import { UsageHint, UsageMeter } from './parts';

const METHOD_LABELS: Record<HistoryMethod, string | null> = {
  photo: 'Foto',
  barcode: 'Código de barras',
  national_code: 'Código nacional',
  unknown: null,
};

const STATUS_TEXT: Record<HistoryStatus, string> = {
  identified: 'Identificado',
  ambiguous: 'Varias coincidencias',
  not_found: 'No identificado',
};

interface DayGroup {
  label: string;
  entries: MedicationHistoryEntry[];
}

/** Agrupa por día manteniendo el orden (el servicio ya las da de la más reciente a la más antigua). */
function groupByDay(entries: MedicationHistoryEntry[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const entry of entries) {
    const label = formatRelativeDay(entry.createdAt) || 'Sin fecha';
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }
  return groups;
}

export default function HistoryScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;

  const history = useAsync(() => MedicationService.getHistory(), [], { isEmpty: (list) => list.length === 0 });
  const subscription = useAsync(() => SubscriptionService.getSubscription(), []);
  const catalog = useAsync(() => SubscriptionService.getPlans(), []);
  const entitlement = useEntitlement();
  const refreshHistory = history.refresh;
  const refreshSubscription = subscription.refresh;
  useRefreshOnFocus(refreshHistory);
  useRefreshOnFocus(refreshSubscription);

  const [pulling, setPulling] = useState(false);
  const onPullRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await Promise.all([refreshHistory(), refreshSubscription()]);
    } finally {
      setPulling(false);
    }
  }, [refreshHistory, refreshSubscription]);

  const groups = useMemo(() => groupByDay(history.data ?? []), [history.data]);
  const usage = subscription.data?.usage ?? null;
  const isPremium = !!subscription.data?.isPremium;
  // El pago por uso solo existe en las suscripciones con tarjeta (Stripe) y si el servidor lo tiene activo.
  // Con Apple o Google Play no hay cobros adicionales: al agotar las incluidas se espera a la renovación.
  const overagePrice =
    isPremium && subscription.data?.provider === 'stripe' && catalog.data?.premiumLimits?.overageEnabled
      ? formatPrice(FALLBACK_OVERAGE_CENTS)
      : undefined;
  // Con Premium las identificaciones son ilimitadas mientras dure la suscripción: no hay nada que contar.
  const showUsage = !!usage && !usage.unlimited && usage.scansIncluded > 0 && history.status !== 'error';
  const canRefresh = history.status === 'success' || history.status === 'empty';

  const usageCard = showUsage && usage ? (
    <Card style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.lg }} testID="history-usage">
      <View style={styles.usageTitle}>
        <Icon name="scan" size={24} color={c.primary} />
        <AppText variant="bodyStrong" color="heading" style={styles.flex}>
          {isPremium
            ? `Este mes: ${usage.scansUsed} de ${usage.scansIncluded} identificaciones incluidas`
            : `Este mes: ${usage.scansUsed} de ${usage.scansIncluded} identificaciones`}
        </AppText>
      </View>
      <UsageMeter used={usage.scansUsed} included={usage.scansIncluded} />
      <UsageHint left={usage.scansLeft} premium={isPremium} overagePrice={overagePrice} />
      {entitlement.canSell && !isPremium ? (
        <TextButton label="Ver Premium" icon="star" align="flex-start" onPress={() => router.push('/premium')} />
      ) : null}
    </Card>
  ) : null;

  const renderBody = () => {
    if (history.status === 'loading') return <SkeletonList rows={5} />;
    if (history.status === 'error') {
      return (
        <ErrorState
          kind={history.error?.kind}
          message={history.error?.message}
          onRetry={() => {
            void history.reload();
            void subscription.reload();
          }}
        />
      );
    }
    if (history.status === 'empty') {
      return (
        <EmptyState
          icon="time-outline"
          title="Todavía no has identificado ningún medicamento"
          message="Haz una foto a la caja o escanea su código y aquí verás lo que hayas consultado."
          action={{ label: 'Identificar un medicamento', icon: 'camera', onPress: () => router.push('/scan') }}
        />
      );
    }
    return (
      <View style={{ gap: theme.spacing.lg }}>
        {groups.map((group) => (
          <ListGroup key={group.label} title={group.label}>
            {group.entries.map((entry) => (
              <HistoryRow
                key={entry.id}
                entry={entry}
                onOpen={
                  entry.status === 'identified' && entry.medicationId
                    ? () => router.push(`/medication/${entry.medicationId}`)
                    : undefined
                }
              />
            ))}
          </ListGroup>
        ))}
        <AppText variant="caption" color="textMuted" align="center">
          Las fotos no se guardan: solo el resultado de cada identificación.
        </AppText>
      </View>
    );
  };

  return (
    <Screen
      header={<AppHeader title="Historial" />}
      refreshControl={
        canRefresh ? (
          <RefreshControl refreshing={pulling} onRefresh={onPullRefresh} tintColor={c.primary} colors={[c.primary]} />
        ) : undefined
      }
    >
      <View style={{ height: theme.spacing.xs }} />
      {usageCard}
      {MedicationService.isUsingCachedData('history') && history.data ? (
        <InfoBanner tone="warning" message="No hay conexión. Estás viendo el último historial guardado en este teléfono." action={{ label: 'Reintentar', onPress: () => void refreshHistory() }} />
      ) : null}
      {renderBody()}
    </Screen>
  );
}

function HistoryRow({ entry, onOpen }: { entry: MedicationHistoryEntry; onOpen?: () => void }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const status = entry.status;
  const icon: IconName =
    status === 'identified' ? 'checkmark-circle' : status === 'ambiguous' ? 'help-circle' : 'close-circle';
  const iconColor = status === 'identified' ? c.successStrong : status === 'ambiguous' ? '#B45309' : c.textMuted;
  const iconBg = status === 'identified' ? c.successSoft : status === 'ambiguous' ? c.warningSoft : c.surfaceMuted;
  const title = entry.medicationName || STATUS_TEXT[status];
  const method = METHOD_LABELS[entry.method];
  const time = formatTime(entry.createdAt);
  const subtitle = [time, method].filter(Boolean).join(' · ');
  const a11y = `${title}. ${STATUS_TEXT[status]}${time ? `, a las ${time}` : ''}${method ? `, con ${method.toLowerCase()}` : ''}`;

  const content = (
    <View style={[styles.row, { minHeight: theme.touchTargets.large }]}>
      <View style={[styles.statusIcon, { backgroundColor: iconBg }]}>
        <Icon name={icon} size={26} color={iconColor} />
      </View>
      <View style={styles.flex}>
        <AppText variant="label" color={status === 'identified' ? 'heading' : 'textSecondary'} numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {onOpen ? <Icon name="chevron-forward" size={22} color={c.textMuted} /> : null}
    </View>
  );

  if (!onOpen) {
    return (
      <View style={styles.rowPad} accessible accessibilityLabel={a11y}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint="Abre la ficha del medicamento"
      style={({ pressed }) => [styles.rowPad, { backgroundColor: pressed ? c.surfaceAlt : 'transparent' }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  usageTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  rowPad: { paddingHorizontal: 16 },
  statusIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
