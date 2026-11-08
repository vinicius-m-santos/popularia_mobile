import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Motion } from '@/constants/motion';
import { Colors, MaxContentWidth } from '@/constants/theme';

import { ProfileTabs } from '../profile-tab-swipe';
import { PROFILE_TABS_HEIGHT, PROFILE_TABS_UNDERLINE_HEIGHT, type ProfileTabKey } from '../profile-tabs';

export type ProfileTabsOverlayHandle = {
  /** Mostra/recolhe a barra. Chamadas repetidas com o mesmo valor são no-op. */
  setVisible: (open: boolean) => void;
  hide: () => void;
};

type ProfileTabsOverlayProps = {
  options: { key: ProfileTabKey; label: string }[];
  value: ProfileTabKey;
  onChange: (key: ProfileTabKey) => void;
};

/**
 * O overlay acompanha a rolagem; nenhuma das transições é comandada pelo dedo.
 * Com Reduce Motion, o Reanimated aplica o valor final sem animar a barra.
 */
export const PROFILE_TABS_OVERLAY_TIMING = {
  enter: { duration: Motion.duration.normal, easing: Motion.easing.standard, reduceMotion: ReduceMotion.System },
  enterOpacity: { duration: Motion.duration.fast, reduceMotion: ReduceMotion.System },
  exit: { duration: Motion.duration.normal, easing: Motion.easing.settle, reduceMotion: ReduceMotion.System },
  exitOpacity: { duration: Motion.duration.fast, reduceMotion: ReduceMotion.System },
} as const;

/**
 * Barra de abas que recolhe enquanto a lista do perfil rola.
 *
 * O estado de visibilidade fica aqui, não no corpo do perfil: o `onScroll` do
 * JS pode chamar `setVisible` a cada frame sem re-renderizar a lista inteira.
 * A animação continua na UI thread (Reanimated) e a montagem é preguiçosa,
 * preservando a árvore e a acessibilidade do desenho anterior.
 */
export const ProfileTabsOverlay = forwardRef<ProfileTabsOverlayHandle, ProfileTabsOverlayProps>(
  function ProfileTabsOverlay({ options, value, onChange }, ref) {
    const translate = useSharedValue(-PROFILE_TABS_HEIGHT);
    const opacity = useSharedValue(0);
    const visible = useRef(false);
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);

    const setVisible = useCallback((next: boolean) => {
      if (visible.current === next) return;
      visible.current = next;
      if (next) {
        setMounted(true);
        setOpen(true);
        translate.value = withTiming(0, PROFILE_TABS_OVERLAY_TIMING.enter);
        opacity.value = withTiming(1, PROFILE_TABS_OVERLAY_TIMING.enterOpacity);
        return;
      }
      setOpen(false);
      translate.value = withTiming(-PROFILE_TABS_HEIGHT, PROFILE_TABS_OVERLAY_TIMING.exit);
      opacity.value = withTiming(0, PROFILE_TABS_OVERLAY_TIMING.exitOpacity);
    }, [opacity, translate]);

    const hide = useCallback(() => setVisible(false), [setVisible]);
    useImperativeHandle(ref, () => ({ setVisible, hide }), [hide, setVisible]);

    const overlayStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: translate.value }],
      opacity: opacity.value,
    }));

    if (!mounted) return null;
    return (
      <Animated.View
        testID="profile-tabs-overlay"
        style={[styles.overlay, overlayStyle]}
        pointerEvents={open ? 'auto' : 'none'}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}>
        <View style={styles.tabInner}>
          <View style={styles.column}>
            <ProfileTabs
              options={options}
              value={value}
              onChange={onChange}
              height={PROFILE_TABS_HEIGHT}
              labelStyle={styles.tabLabel}
              activeWeight
              underlineHeight={PROFILE_TABS_UNDERLINE_HEIGHT}
            />
          </View>
        </View>
      </Animated.View>
    );
  },
);

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
    backgroundColor: Colors.cream,
  },
  tabInner: {
    height: PROFILE_TABS_HEIGHT,
    justifyContent: 'center',
    backgroundColor: Colors.cream,
    borderBottomWidth: 2,
    borderBottomColor: Colors.ink,
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  tabLabel: {
    fontSize: 14.5,
    lineHeight: 19,
  },
});
