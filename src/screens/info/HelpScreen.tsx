/**
 * Ayuda (/help) — pública. Preguntas frecuentes en tarjetas desplegables,
 * tutorial, soporte (solo si el propietario configuró el correo) e información legal.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, AppHeader, AppText, ListGroup, SecondaryButton, SectionHeader, SettingRow } from '../../components';
import { useAppTheme } from '../../hooks';
import { PURCHASES_ENABLED, SUPPORT_EMAIL } from '../../config/app';
import { composeEmail } from '../../utils/device';
import { showAlert } from '../../utils/dialogs';
import { AccordionItem, Bullets, Paragraph, useHomeHref } from './parts';

interface Faq {
  id: string;
  question: string;
  paragraphs: string[];
  bullets?: string[];
}

const FAQS: Faq[] = [
  {
    id: 'identify',
    question: '¿Cómo identifico un medicamento?',
    paragraphs: [
      'En el Inicio, pulsa «Identificar un medicamento» y haz una foto a la caja, con el nombre bien visible. También puedes escribir el código nacional (C.N.) de la caja.',
      'En unos segundos verás para qué sirve, cómo se toma y qué precauciones tener.',
    ],
  },
  {
    id: 'source',
    question: '¿De dónde sale la información?',
    paragraphs: [
      'De CIMA, el centro de información de medicamentos de la AEMPS (la Agencia Española de Medicamentos y Productos Sanitarios). Es la fuente oficial en España.',
      'Nosotros la explicamos con palabras sencillas, y siempre puedes consultar la ficha oficial.',
    ],
  },
  {
    id: 'not-recognized',
    question: '¿Qué hago si no reconoce mi medicamento?',
    paragraphs: ['Prueba una de estas opciones:'],
    bullets: [
      'Haz la foto con buena luz, sin reflejos y con la caja entera dentro del recuadro.',
      'Escribe el código nacional: son 6 cifras que aparecen en la caja junto a las letras «C.N.».',
    ],
  },
  {
    id: 'text-size',
    question: '¿Cómo pongo la letra más grande?',
    paragraphs: [
      'Ve a Perfil → Tamaño del texto y elige «Grande» o «Muy grande».',
      'También puedes activar el Modo fácil en Perfil: letra y botones más grandes y menos opciones en pantalla.',
    ],
  },
  PURCHASES_ENABLED
    ? {
        id: 'premium',
        question: '¿Qué incluye Premium y cómo lo cancelo?',
        paragraphs: [
          'Con Premium puedes identificar medicamentos con una foto, preguntar al asistente, escuchar el prospecto en voz alta y guardar tus medicamentos. Hay plan mensual, trimestral y anual.',
          'Puedes cancelarlo cuando quieras, sin permanencia, en Perfil → MediClaro Premium → Gestionar suscripción. Si lo contrataste con Apple o Google Play, también desde los ajustes de suscripciones de tu teléfono.',
          'Si cambias de teléfono, entra con tu número («Ya soy Premium») o pulsa «Restaurar compra».',
          'Las emergencias y el 112 son siempre gratis y no necesitan cuenta.',
        ],
      }
    : {
        id: 'plan',
        question: '¿Cuántas identificaciones puedo hacer?',
        paragraphs: [
          'Tu plan incluye un número de identificaciones al mes y de preguntas al asistente cada día. Las búsquedas que no encuentran el medicamento no cuentan.',
          'Puedes ver cuántas te quedan en el Inicio, en el Historial y en Perfil → Tu plan.',
        ],
      },
  {
    id: 'emergency',
    question: '¿Qué hace el botón de Emergencia?',
    paragraphs: [
      'Te ayuda a pedir ayuda rápido. El botón rojo llama al 112, el número oficial de emergencias. Está siempre disponible y es distinto de todo lo demás.',
      'El botón azul llama a tu servicio privado de asistencia (por ejemplo, tu teleasistencia), si lo tienes.',
      'Nunca llamamos a nadie sin que tú lo pulses.',
    ],
  },
  {
    id: 'photos',
    question: '¿Guardáis mis fotos?',
    paragraphs: [
      'No. La foto solo se usa para identificar la caja del medicamento y MediClaro no la guarda.',
      'Para leerla, con tu permiso, la enviamos a la inteligencia artificial de Google (Gemini), que no la usa para mejorar sus productos.',
    ],
  },
  {
    id: 'assistant',
    question: '¿El asistente sustituye a mi médico?',
    paragraphs: [
      'No. El asistente con IA te ayuda a entender tus medicamentos, pero puede equivocarse y no sustituye a tu médico o farmacéutico.',
      'Ante cualquier duda importante, consúltales. En una urgencia, llama al 112.',
    ],
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const homeHref = useHomeHref();
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const writeToSupport = async () => {
    const ok = await composeEmail(SUPPORT_EMAIL, 'Ayuda con MediClaro');
    if (!ok) await showAlert('No se ha podido abrir el correo', `Escríbenos a ${SUPPORT_EMAIL}`);
  };

  return (
    <Screen header={<AppHeader title="Ayuda" fallbackHref={homeHref} />}>
      <AppText variant="heading" accessibilityRole="header" style={{ marginTop: theme.spacing.xs }}>
        ¿En qué te podemos ayudar?
      </AppText>
      <AppText variant="body" color="textSecondary" style={{ marginTop: theme.spacing.xxs, marginBottom: theme.spacing.md }}>
        Toca una pregunta para ver la respuesta.
      </AppText>

      <View style={{ gap: theme.spacing.sm }}>
        {FAQS.map((faq) => (
          <AccordionItem
            key={faq.id}
            title={faq.question}
            expanded={open.has(faq.id)}
            onToggle={() => toggle(faq.id)}
            testID={`faq-${faq.id}`}
          >
            {faq.paragraphs.map((p) => (
              <Paragraph key={p}>{p}</Paragraph>
            ))}
            {faq.bullets ? <Bullets items={faq.bullets} /> : null}
          </AccordionItem>
        ))}
      </View>

      <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
        <SectionHeader title="Más ayuda" />
        <SecondaryButton
          label="Ver el tutorial otra vez"
          icon="play-circle-outline"
          onPress={() => router.push('/onboarding')}
          testID="help-tutorial"
        />
        {SUPPORT_EMAIL ? (
          <SecondaryButton
            label="Escribir a soporte"
            icon="mail-outline"
            variant="outline"
            onPress={writeToSupport}
            accessibilityHint={`Abre tu correo para escribir a ${SUPPORT_EMAIL}`}
            testID="help-support"
          />
        ) : null}
        <ListGroup style={{ marginTop: theme.spacing.xs }}>
          <SettingRow
            icon="document-text-outline"
            label="Información legal"
            description="Aviso médico, privacidad y condiciones"
            onPress={() => router.push('/legal')}
            testID="help-legal"
          />
        </ListGroup>
      </View>
    </Screen>
  );
}
