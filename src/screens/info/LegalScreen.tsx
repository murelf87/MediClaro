/**
 * Información legal (/legal?section=medical|sources|ai|subscription|terms|privacy|notice) — pública.
 * «Condiciones de la suscripción» se lee siempre dentro de la app (precios del catálogo real).
 * Tarjetas desplegables; se abre (y se muestra) la indicada en `section`.
 * Los documentos que el propietario aún no ha publicado se muestran como
 * "Pendiente de publicación" (sin enlace), nunca como un botón que no hace nada.
 */
import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, AppHeader, AppText, TextButton, type IconName } from '../../components';
import { useAppTheme, useAsync } from '../../hooks';
import { APP_NAME, APP_VERSION, COMPANY_INFO, LEGAL_URLS, PURCHASES_ENABLED } from '../../config/app';
import { SubscriptionService, perPeriodPhrase, periodName } from '../../services';
import { formatPrice } from '../../utils/format';
import { openExternalUrl } from '../../utils/device';
import { showAlert } from '../../utils/dialogs';
import { AccordionItem, DocumentRow, Paragraph, useHomeHref } from './parts';

type SectionId = 'medical' | 'sources' | 'ai' | 'subscription' | 'terms' | 'privacy' | 'notice';

const SECTION_IDS: SectionId[] = ['medical', 'sources', 'ai', 'subscription', 'terms', 'privacy', 'notice'];
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

  const companyLines = [
    COMPANY_INFO.name ? `Titular: ${COMPANY_INFO.name}` : '',
    COMPANY_INFO.taxId ? `NIF: ${COMPANY_INFO.taxId}` : '',
    COMPANY_INFO.address ? `Domicilio: ${COMPANY_INFO.address}` : '',
  ].filter(Boolean);

  const sections: { id: SectionId; title: string; icon: IconName; iconColor?: string; body: ReactNode }[] = [
    {
      id: 'medical',
      title: 'Aviso médico',
      icon: 'medkit-outline',
      body: (
        <>
          <Paragraph>
            {`${APP_NAME} te muestra la información oficial de la AEMPS explicada de forma sencilla.`}
          </Paragraph>
          <Paragraph>
            No sustituye a tu médico o farmacéutico: consúltales antes de empezar, dejar o cambiar un tratamiento.
          </Paragraph>
          <Paragraph>En una urgencia, llama al 112.</Paragraph>
        </>
      ),
    },
    {
      id: 'sources',
      title: 'Origen de la información',
      icon: 'library-outline',
      body: (
        <>
          <Paragraph>
            Los datos de los medicamentos proceden de CIMA, el Centro de Información online de Medicamentos de la AEMPS
            (Agencia Española de Medicamentos y Productos Sanitarios).
          </Paragraph>
          <Paragraph>Es la información oficial y autorizada de cada medicamento en España.</Paragraph>
          <TextButton label="Abrir CIMA" icon="open-outline" align="flex-start" onPress={openCima} accessibilityHint="Abre la web oficial de CIMA" testID="legal-cima" />
        </>
      ),
    },
    {
      id: 'ai',
      title: 'Uso de inteligencia artificial',
      icon: 'sparkles-outline',
      iconColor: theme.colors.ai,
      body: (
        <>
          <Paragraph>
            Los resúmenes con palabras sencillas, la lectura de las fotos de las cajas y el asistente usan Gemini, la
            inteligencia artificial de Google.
          </Paragraph>
          <Paragraph>Pueden contener errores. Si algo no coincide, lo que vale es la ficha oficial del medicamento.</Paragraph>
          <Paragraph>
            Antes de enviar tu primera foto o tu primera pregunta te pedimos permiso. Solo enviamos la foto o la pregunta,
            nunca tu nombre ni tu teléfono. Google no las usa para mejorar sus productos y solo las guarda hasta 55 días
            para evitar abusos. MediClaro no guarda tus fotos ni el texto de tus preguntas.
          </Paragraph>
          <Paragraph>Puedes retirar el permiso cuando quieras en Perfil › Privacidad y datos.</Paragraph>
        </>
      ),
    },
    ...(PURCHASES_ENABLED
      ? [
          {
            id: 'subscription' as const,
            title: 'Condiciones de la suscripción',
            icon: 'ribbon-outline' as IconName,
            body: (
              <>
                <Paragraph>MediClaro Premium es una suscripción con renovación automática. Planes:</Paragraph>
                {planLines.length ? (
                  planLines.map((line) => (
                    <AppText key={line} variant="body" color="text">
                      {`• ${line}`}
                    </AppText>
                  ))
                ) : (
                  <Paragraph>Los precios se muestran en la pantalla de Premium antes de pagar.</Paragraph>
                )}
                <Paragraph>
                  Pagas al confirmar la compra: con tu cuenta de Apple, con Google Play o con tu tarjeta (a través de Stripe),
                  según elijas. MediClaro nunca ve ni guarda los datos de tu tarjeta.
                </Paragraph>
                <Paragraph>
                  La suscripción se renueva sola al final de cada periodo por el mismo precio, salvo que la canceles antes de
                  la renovación (con Apple, al menos 24 horas antes). Sin permanencia.
                </Paragraph>
                <Paragraph>
                  Para cancelar: Perfil › MediClaro Premium › Gestionar suscripción. Si la contrataste con Apple, también en
                  Ajustes del iPhone › tu nombre › Suscripciones; con Google Play, en Google Play › Pagos y suscripciones. Al
                  cancelar sigues teniendo Premium hasta el final del periodo pagado. Eliminar tu cuenta o borrar la app no
                  cancela una suscripción de Apple o de Google Play.
                </Paragraph>
                <Paragraph>
                  Si cambias de teléfono, entra con tu número («Ya soy Premium») o pulsa «Restaurar compra». Las devoluciones de
                  compras hechas con Apple o Google Play se piden a Apple o a Google, según sus condiciones; para pagos con
                  tarjeta, escríbenos.
                </Paragraph>
                <Paragraph>Las emergencias y el 112 son siempre gratis, con o sin Premium.</Paragraph>
                <DocumentRow url={LEGAL_URLS.terms} label="Leer las Condiciones de uso completas" />
              </>
            ),
          },
        ]
      : []),
    {
      id: 'terms',
      title: 'Condiciones de uso',
      icon: 'document-text-outline',
      body: (
        <>
          <Paragraph>Las normas para usar MediClaro: qué ofrece la app y cuáles son tus derechos y obligaciones.</Paragraph>
          <DocumentRow url={LEGAL_URLS.terms} label="Leer las Condiciones de uso" />
        </>
      ),
    },
    {
      id: 'privacy',
      title: 'Política de privacidad',
      icon: 'lock-closed-outline',
      body: (
        <>
          <Paragraph>Qué datos personales tratamos, para qué los usamos y cómo ejercer tus derechos.</Paragraph>
          <DocumentRow url={LEGAL_URLS.privacy} label="Leer la Política de privacidad" icon="lock-closed-outline" />
        </>
      ),
    },
    {
      id: 'notice',
      title: 'Aviso legal',
      icon: 'business-outline',
      body: (
        <>
          <Paragraph>Quién es el titular de MediClaro y cómo contactar.</Paragraph>
          {companyLines.map((line) => (
            <AppText key={line} variant="body" color="text">
              {line}
            </AppText>
          ))}
          <DocumentRow url={LEGAL_URLS.legalNotice} label="Leer el Aviso legal" icon="business-outline" />
        </>
      ),
    },
  ];

  return (
    <Screen header={<AppHeader title="Información legal" fallbackHref={homeHref} />} scrollRef={scrollRef}>
      <AppText variant="body" color="textSecondary" style={{ marginTop: theme.spacing.xs, marginBottom: theme.spacing.md }}>
        Toca cada apartado para leerlo.
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
