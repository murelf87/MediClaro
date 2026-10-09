/**
 * Información legal (/legal?section=medical|sources|ai|emergency|subscription|terms|privacy|notice) — pública.
 * Todos los apartados se leen COMPLETOS dentro de la app (src/content/legal.ts), en letra pequeña; si el propietario
 * publica además los textos en su web, se ofrece también el enlace. «Condiciones de la suscripción» usa los precios
 * del catálogo real. Tarjetas desplegables; se abre (y se muestra) la indicada en `section`.
 */
import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, AppHeader, AppText, TextButton, type IconName } from '../../components';
import { useAppTheme, useAsync } from '../../hooks';
import { APP_NAME, APP_VERSION, COMPANY_INFO, LEGAL_URLS, PURCHASES_ENABLED, SUPPORT_EMAIL } from '../../config/app';
import { SubscriptionService, perPeriodPhrase, periodName } from '../../services';
import { formatPrice } from '../../utils/format';
import { openExternalUrl } from '../../utils/device';
import { showAlert } from '../../utils/dialogs';
import {
  LEGAL_UPDATED,
  aiBlocks,
  emergencyBlocks,
  medicalBlocks,
  noticeBlocks,
  privacyBlocks,
  sourcesBlocks,
  subscriptionBlocks,
  termsBlocks,
  type LegalBlock,
  type LegalContext,
  type LegalSectionId,
} from '../../content/legal';
import { AccordionItem, DocumentRow, useHomeHref } from './parts';

type SectionId = LegalSectionId;

const SECTION_IDS: SectionId[] = ['medical', 'sources', 'ai', 'emergency', 'subscription', 'terms', 'privacy', 'notice'];

/** Texto legal en letra pequeña: subtítulos, párrafos y listas. */
function LegalText({ blocks }: { blocks: LegalBlock[] }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      {blocks.map((b, i) =>
        'h' in b ? (
          <AppText key={i} variant="captionStrong" color="heading" style={{ marginTop: i ? theme.spacing.xs : 0 }} accessibilityRole="header">
            {b.h}
          </AppText>
        ) : 'p' in b ? (
          <AppText key={i} variant="caption" color="textSecondary">
            {b.p}
          </AppText>
        ) : (
          <View key={i} style={{ gap: 4 }}>
            {b.list.map((item) => (
              <View key={item} style={styles.bullet}>
                <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
                <AppText variant="caption" color="textSecondary" style={styles.flex}>
                  {item}
                </AppText>
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  );
}
const CIMA_URL = 'https://cima.aemps.es';

function isSectionId(value: unknown): value is SectionId {
  return typeof value === 'string' && (SECTION_IDS as string[]).includes(value);
}

export default function LegalScreen() {
  const theme = useAppTheme();
  const homeHref = useHomeHref();
  const params = useLocalSearchParams<{ section?: string | string[] }>();
  const raw = Array.isArray(params.section) ? params.section[0] : params.section;
  const initial = isSectionId(raw) ? raw : null;

  const [open, setOpen] = useState<Set<SectionId>>(() => new Set(initial ? [initial] : []));
  const scrollRef = useRef<ScrollView>(null);
  const listY = useRef<number | null>(null);
  const targetY = useRef<number | null>(null);
  const scrolled = useRef(false);

  const toggle = (id: SectionId) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Lleva la tarjeta pedida a la vista (una sola vez, al abrir la pantalla)
  const tryScroll = () => {
    if (scrolled.current || listY.current === null || targetY.current === null) return;
    scrolled.current = true;
    // La primera tarjeta ya está a la vista: solo desplazamos para las demás
    if (targetY.current <= 0) return;
    const y = Math.max(0, listY.current + targetY.current - theme.spacing.sm);
    setTimeout(() => scrollRef.current?.scrollTo({ y, animated: true }), 120);
  };

  const openCima = async () => {
    const ok = await openExternalUrl(CIMA_URL);
    if (!ok) await showAlert('No se ha podido abrir la web', `Puedes consultarla en ${CIMA_URL}`);
  };

  const catalog = useAsync(() => (PURCHASES_ENABLED ? SubscriptionService.getPlans() : Promise.resolve(null)), []);
  const planLines = (catalog.data?.plans ?? []).map(
    (p) => `${periodName(p.period)}: ${formatPrice(p.priceCents)} ${perPeriodPhrase(p.period)} (IVA incluido)`,
  );

  const ctx: LegalContext = {
    company: { name: COMPANY_INFO.name, taxId: COMPANY_INFO.taxId, address: COMPANY_INFO.address },
    supportEmail: SUPPORT_EMAIL,
    purchases: PURCHASES_ENABLED,
    planLines,
  };
  const web = (url: string, label: string, icon?: IconName) =>
    url ? <DocumentRow url={url} label={label} icon={icon} /> : null;

  const sections: { id: SectionId; title: string; icon: IconName; iconColor?: string; body: ReactNode }[] = [
    { id: 'medical', title: 'Aviso médico', icon: 'medkit-outline', body: <LegalText blocks={medicalBlocks()} /> },
    {
      id: 'sources',
      title: 'Origen de la información',
      icon: 'library-outline',
      body: (
        <>
          <LegalText blocks={sourcesBlocks()} />
          <TextButton label="Abrir CIMA" icon="open-outline" align="flex-start" onPress={openCima} accessibilityHint="Abre la web oficial de CIMA" testID="legal-cima" />
        </>
      ),
    },
    { id: 'ai', title: 'Uso de inteligencia artificial', icon: 'sparkles-outline', iconColor: theme.colors.ai, body: <LegalText blocks={aiBlocks()} /> },
    { id: 'emergency', title: 'Emergencias, cuidador/a y ubicación', icon: 'call-outline', body: <LegalText blocks={emergencyBlocks()} /> },
    ...(PURCHASES_ENABLED
      ? [
          {
            id: 'subscription' as const,
            title: 'Condiciones de la suscripción',
            icon: 'ribbon-outline' as IconName,
            body: <LegalText blocks={subscriptionBlocks(ctx)} />,
          },
        ]
      : []),
    {
      id: 'terms',
      title: 'Condiciones de uso',
      icon: 'document-text-outline',
      body: (
        <>
          <LegalText blocks={termsBlocks(ctx)} />
          {web(LEGAL_URLS.terms, 'Ver también en la web')}
        </>
      ),
    },
    {
      id: 'privacy',
      title: 'Política de privacidad',
      icon: 'lock-closed-outline',
      body: (
        <>
          <LegalText blocks={privacyBlocks(ctx)} />
          {web(LEGAL_URLS.privacy, 'Ver también en la web', 'lock-closed-outline')}
        </>
      ),
    },
    {
      id: 'notice',
      title: 'Aviso legal',
      icon: 'business-outline',
      body: (
        <>
          <LegalText blocks={noticeBlocks(ctx)} />
          {web(LEGAL_URLS.legalNotice, 'Ver también en la web', 'business-outline')}
        </>
      ),
    },
  ];

  return (
    <Screen header={<AppHeader title="Información legal" fallbackHref={homeHref} />} scrollRef={scrollRef}>
      <AppText variant="caption" color="textSecondary" style={{ marginTop: theme.spacing.xs, marginBottom: theme.spacing.md }}>
        {`Toca cada apartado para leerlo. Última actualización: ${LEGAL_UPDATED}.`}
      </AppText>

      <View
        style={{ gap: theme.spacing.sm }}
        onLayout={(e) => {
          listY.current = e.nativeEvent.layout.y;
          tryScroll();
        }}
      >
        {sections.map((s) => (
          <AccordionItem
            key={s.id}
            title={s.title}
            icon={s.icon}
            iconColor={s.iconColor}
            expanded={open.has(s.id)}
            onToggle={() => toggle(s.id)}
            testID={`legal-${s.id}`}
            onLayout={
              s.id === initial
                ? (e) => {
                    targetY.current = e.nativeEvent.layout.y;
                    tryScroll();
                  }
                : undefined
            }
          >
            {s.body}
          </AccordionItem>
        ))}
      </View>

      <AppText variant="caption" color="textMuted" align="center" style={{ marginTop: theme.spacing.xl }}>
        {`${APP_NAME} ${APP_VERSION}`}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 8 },
});
