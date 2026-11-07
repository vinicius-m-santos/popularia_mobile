import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';

/**
 * Pressable com `style` animável pelo Reanimated.
 *
 * O toque continua sendo do Pressable original; o estilo animado é aplicado no
 * mesmo nó, sem um View extra que mudaria a área de toque ou o layout flex.
 */
export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
