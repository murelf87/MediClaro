/**
 * /medication/<id> — Ficha del medicamento (referencia 07_detail).
 * Datos oficiales de CIMA · AEMPS. Resumen sencillo (si existe) + prospecto oficial por apartados.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppHeader,
  AppText,
  Card,
  Divider,
  Icon,
  InfoBanner,
  PrimaryButton,
  Screen,
  SecondaryButton,
} from '../../components';
import { useAppTheme, useAsync } from '../../hooks';
import { MedicationService } from '../../services';
import { openExternalUrl } from '../../utils/device';
import { showAlert } from '../../utils/dialogs';
import { formatDateLong } from '../../utils/format';
import type { MedicationDetail } from '../../types';
import { composeWhatIs, detailSubtitle, firstParam } from './helpers';
import { BulletList, DetailSkeleton, FavoriteButton, IconCircle, ScreenError, SectionCard, useNavLock } from './parts';
import { useSavedMedication } from './useSavedMedication';

export default function MedicationDetailScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const navigate = useNavLock();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = firstParam(params.id) ?? '';

  const detail = useAsync(() => MedicationService.getMedication(id), [id]);
  const d = detail.data;
  const saved = useSavedMedication(d);

  const header = <AppHeader right={d ? <FavoriteButton state={saved} /> : undefined} />;

  if (!d) {
    return (
      <Screen header={header} contentStyle={detail.status === 'error' ? styles.grow : undefined}>
        {detail.status === 'error' && detail.error ? (
          <ScreenError
            error={detail.error}
            onRetry={detail.reload}
            notFoundTitle="No encontramos este medicamento en la base oficial"
            notFoundMessage="Puede que el código no sea correcto o que ya no figure en la base de la AEMPS."
          />
        ) : (
          <DetailSkeleton />
        )}
      </Screen>
    );
  }

  const openVoice = () => navigate(() => router.push({ pathname: '/voice', params: { id: d.id, name: d.name } }));
  const openChat = () =>
    navigate(() => router.push({ pathname: '/assistant', params: { medicationId: d.id, medicationName: d.name } }));
  const stacked = theme.fontSize === 'muy_grande';

  return (
    <Screen
      header={header}
      footer={
        <View style={[styles.footerRow, stacked ? styles.footerStacked : null, { gap: theme.spacing.sm }]}>
          <PrimaryButton
            label="Leer en voz alta"
            icon="volume-high"
            onPress={openVoice}
            style={[stacked ? null : styles.flex, styles.footerButton]}
            testID="detail-voice"
          />
          <SecondaryButton
            label="Preguntar a la IA"
            icon="chatbubble-ellipses"
            size="lg"
            onPress={openChat}
            style={[stacked ? null : styles.flex, styles.footerButton]}
            testID="detail-chat"
          />
        </View>
      }
    >
      <DetailContent d={d} />
    </Screen>
  );
}

function DetailContent({ d }: { d: MedicationDetail }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const simple = d.simple;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  /** Sin resumen sencillo, el prospecto se muestra desplegado. */
  const leafletOpenByDefault = !simple;
  const fetched = formatDateLong(d.source.fetchedAt);

  const openUrl = async (url: string) => {
    const ok = await openExternalUrl(url);
    if (!ok) await showAlert('No se ha podido abrir el enlace', 'Comprueba tu conexión a internet e inténtalo de nuevo.');
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ gap: theme.spacing.xxs, marginTop: theme.spacing.xxs }}>
        <AppText variant="title" accessibilityRole="header">
          {d.name}
        </AppText>
        {d.officialName && d.officialName !== d.name ? (
          <AppText variant="caption" color="textSecondary" accessibilityLabel={`Nombre oficial: ${d.officialName}`}>
            {d.officialName}
          </AppText>
        ) : null}
        <AppText variant="body" color="textSecondary">
          {detailSubtitle(d)}
        </AppText>
      </View>

      {!d.isMarketed ? (
        <InfoBanner
          tone="warning"
          title="Este medicamento no se comercializa actualmente."
          message="Puede que no lo encuentres en la farmacia. Consulta a tu farmacéutico."
        />
      ) : null}
      {!simple ? (
        <InfoBanner tone="info" icon="document-text" title="Te mostramos el prospecto oficial." message="Todavía no hay un resumen sencillo de este medicamento." />
      ) : null}

      <SectionCard icon="information-circle" solid tone="success" title="¿Qué es?">
        <AppText variant="body">{composeWhatIs(d)}</AppText>
      </SectionCard>

      {simple ? (
        <>
          {simple.whatFor.trim() ? (
            <SectionCard icon="medical" tone="primary" title="¿Para qué se utiliza?">
              <AppText variant="body">{simple.whatFor}</AppText>
            </SectionCard>
          ) : null}
          {simple.howToTake.trim() ? (
            <SectionCard icon="time" tone="primary" title="¿Cómo se toma?">
              <AppText variant="body">{simple.howToTake}</AppText>
            </SectionCard>
          ) : null}
          {simple.warnings.length ? (
            <SectionCard icon="warning" tone="danger" title="Advertencias importantes" tinted>
              <BulletList items={simple.warnings} tone="danger" />
            </SectionCard>
          ) : null}
          {simple.storage.trim() ? (
            <SectionCard icon="thermometer-outline" tone="neutral" title="Conservación">
              <AppText variant="body">{simple.storage}</AppText>
            </SectionCard>
          ) : null}
          {simple.aiAssisted ? (
            <InfoBanner
              tone="ai"
              icon="sparkles"
              message="Resumen sencillo elaborado con ayuda de IA a partir del prospecto oficial. Si tienes dudas, consulta a tu médico o farmacéutico."
            />
          ) : null}
        </>
      ) : null}

      {d.leaflet.length ? (
        <Card padding={0} style={styles.clip}>
          <View style={[styles.cardHead, { padding: theme.spacing.md }]}>
            <IconCircle icon="document-text" tone="primary" />
            <AppText variant="heading" style={styles.flex} accessibilityRole="header">
              Prospecto oficial
            </AppText>
          </View>
          {d.leaflet.map((s, i) => {
            const key = `${s.key}-${i}`;
            const isOpen = open[key] ?? leafletOpenByDefault;
            return (
              <View key={key}>
                <Divider />
                <Pressable
                  onPress={() => setOpen((prev) => ({ ...prev, [key]: !isOpen }))}
                  accessibilityRole="button"
                  accessibilityLabel={s.title}
                  accessibilityHint={isOpen ? 'Oculta este apartado' : 'Muestra este apartado'}
                  accessibilityState={{ expanded: isOpen }}
                  style={({ pressed }) => [
                    styles.leafletRow,
                    { minHeight: theme.touchTargets.comfortable, paddingHorizontal: theme.spacing.md, backgroundColor: pressed ? c.surfaceAlt : 'transparent' },
                  ]}
                >
                  <AppText variant="bodyStrong" color="heading" style={styles.flex}>
                    {s.title}
                  </AppText>
                  <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={22} color={c.primary} />
                </Pressable>
                {isOpen ? (
                  <AppText variant="body" style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md }}>
                    {s.text}
                  </AppText>
                ) : null}
              </View>
            );
          })}
        </Card>
      ) : null}

      {d.presentations.length ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText variant="subheading" color="heading" accessibilityRole="header">
            Presentaciones
          </AppText>
          {d.presentations.map((p) => (
            <View key={`${p.nationalCode}-${p.name}`} style={{ gap: 2 }}>
              <AppText variant="body">{p.name}</AppText>
              <AppText variant="caption" color="textSecondary">{`C.N. ${p.nationalCode}`}</AppText>
            </View>
          ))}
        </Card>
      ) : null}

      <View style={[styles.source, { borderColor: c.border, borderRadius: theme.radius.md, backgroundColor: c.surfaceAlt }]} accessible>
        <Icon name="shield-checkmark" size={24} color={c.successStrong} />
        <View style={styles.flex}>
          <AppText variant="captionStrong" color="heading">
            Fuente de la información: Agencia Española de Medicamentos y Productos Sanitarios www.aemps.gob.es
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {`Base de datos CIMA.${fetched ? ` Datos obtenidos el ${fetched}.` : ''}`}
          </AppText>
          {simple?.aiAssisted ? (
            <AppText variant="caption" color="textSecondary">
              El resumen sencillo lo prepara MediClaro con IA: no es un texto de la AEMPS.
            </AppText>
          ) : null}
        </View>
      </View>

      {d.leafletUrl || d.technicalSheetUrl ? (
        <View style={{ gap: theme.spacing.sm }}>
          {d.leafletUrl ? (
            <SecondaryButton
              label="Ver prospecto oficial"
              icon="open-outline"
              variant="outline"
              onPress={() => openUrl(d.leafletUrl ?? '')}
              accessibilityHint="Abre el prospecto en la web oficial de la AEMPS"
            />
          ) : null}
          {d.technicalSheetUrl ? (
            <SecondaryButton
              label="Ficha técnica"
              icon="reader-outline"
              variant="neutral"
              onPress={() => openUrl(d.technicalSheetUrl ?? '')}
              accessibilityHint="Abre la ficha técnica para profesionales en la web oficial de la AEMPS"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  clip: { overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  leafletRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1 },
  footerRow: { flexDirection: 'row' },
  footerStacked: { flexDirection: 'column' },
  footerButton: { paddingHorizontal: 12 },
});
