/** Función de MediClaro Premium: sin Premium muestra la pantalla de bloqueo (src/screens/premium/PremiumGate). */
import Screen from '../../src/screens/identify/MedicationDetailScreen';
import { withPremium } from '../../src/screens/premium/PremiumGate';

export default withPremium(Screen, 'medicines');
