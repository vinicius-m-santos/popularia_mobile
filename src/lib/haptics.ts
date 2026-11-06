import * as Haptics from 'expo-haptics';
import { Platform, type PlatformOSType } from 'react-native';

/**
 * Feedback tátil curto e contextual.
 *
 * O serviço é deliberadamente pequeno: dispara e esquece, sem prender o JS em
 * promise nem em timer. No iOS, os geradores nativos respeitam o Taptic Engine
 * desligado, o Modo de Baixa Energia, a câmera e o ditado. No Android usamos
 * `performAndroidHapticsAsync`, que passa pelo `performHapticFeedback` da view e
 * respeita o ajuste de toque do sistema (além de não exigir permissão VIBRATE).
 *
 * Se o módulo nativo não existir (build antigo/Expo Go) ou o aparelho não tiver
 * motor, a chamada falha em silêncio. Nada de haptic em efeitos, scroll, digitação
 * ou abertura de folha: os pontos de uso chamam o serviço só em ações diretas.
 */
export type HapticFeedback = 'selection' | 'light' | 'success';

type HapticsClient = Pick<
  typeof Haptics,
  'selectionAsync' | 'impactAsync' | 'notificationAsync' | 'performAndroidHapticsAsync'
>;

type HapticsOptions = {
  client?: HapticsClient;
  platform?: PlatformOSType;
  now?: () => number;
};

/** Janela mínima entre dois estímulos iguais, para um toque repetido não virar zumbido. */
const COOLDOWN_MS: Record<HapticFeedback, number> = {
  selection: 60,
  light: 80,
  success: 500,
};
/** Evita misturar estímulos diferentes no mesmo instante (ex.: sucesso + impacto). */
const GLOBAL_COOLDOWN_MS = 40;

const ANDROID_FEEDBACK: Record<HapticFeedback, Haptics.AndroidHaptics> = {
  selection: Haptics.AndroidHaptics.Segment_Tick,
  light: Haptics.AndroidHaptics.Virtual_Key,
  success: Haptics.AndroidHaptics.Confirm,
};

/** Relógio monotônico: uma correção de horário do sistema não bloqueia os estímulos. */
function monotonicNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

function request(client: HapticsClient, platform: PlatformOSType, feedback: HapticFeedback): Promise<void> {
  if (platform === 'android') return client.performAndroidHapticsAsync(ANDROID_FEEDBACK[feedback]);
  if (feedback === 'selection') return client.selectionAsync();
  if (feedback === 'success') return client.notificationAsync(Haptics.NotificationFeedbackType.Success);
  return client.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function createHapticsService({ client = Haptics, platform = Platform.OS, now = monotonicNow }: HapticsOptions = {}) {
  let lastAt = Number.NEGATIVE_INFINITY;
  const lastByFeedback: Partial<Record<HapticFeedback, number>> = {};

  return {
    /** Retorna `true` quando o estímulo foi despachado; nunca aguarda o nativo. */
    fire(feedback: HapticFeedback = 'selection'): boolean {
      // Web fora do escopo desta entrega: o Chromium dos testes E2E não tem hardware
      // de vibração e não queremos condicionais de navegador no meio do fluxo.
      if (platform === 'web') return false;

      const at = now();
      if (at - lastAt < GLOBAL_COOLDOWN_MS) return false;
      if (at - (lastByFeedback[feedback] ?? Number.NEGATIVE_INFINITY) < COOLDOWN_MS[feedback]) return false;
      lastAt = at;
      lastByFeedback[feedback] = at;

      try {
        // Fire-and-forget: o toque na tela nunca espera o motor nativo.
        void request(client, platform, feedback).catch(() => undefined);
      } catch {
        // Módulo indisponível ou aparelho sem suporte: feedback é opcional.
      }
      return true;
    },
  };
}

const service = createHapticsService();

/** Dispara um estímulo tátil curto. Não bloqueia e ignora falhas do aparelho. */
export function haptic(feedback: HapticFeedback = 'selection'): void {
  service.fire(feedback);
}
