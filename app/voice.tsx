/** Función de MediClaro Premium: sin Premium muestra la pantalla de bloqueo (src/screens/premium/PremiumGate). */
import Screen from '../src/screens/identify/VoiceScreen';
import { withPremium } from '../src/screens/premium/PremiumGate';

export default withPremium(Screen, 'voice');
