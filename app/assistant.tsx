/** Función de MediClaro Premium: sin Premium muestra la pantalla de bloqueo (src/screens/premium/PremiumGate). */
import Screen from '../src/screens/assistant/AssistantChatScreen';
import { withPremium } from '../src/screens/premium/PremiumGate';

export default withPremium(Screen, 'assistant');
