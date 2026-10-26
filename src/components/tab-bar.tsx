import { router, useSegments } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useUnreadCount } from '@/features/notifications/use-unread-count';

/** Ícone de cada rota de aba; o nome da rota é o nome do arquivo em `src/app/(tabs)`. */
const TAB_ICONS: Record<string, IconName> = {
  '(inicio)': 'home',
  explorar: 'search',
  avisos: 'bell',
  perfil: 'user',
};

/** Posição do botão "Criar" entre as abas, como no design. */
const CREATE_BUTTON_INDEX = 2;

/** Na discussão a barra some para dar lugar ao campo de comentário (design 1c). */
const HIDDEN_ON_SEGMENTS = ['post'];

/**
 * Barra inferior escura do design: quatro abas e o botão vermelho de criar
 * publicação no centro, que abre a rota modal `/criar`.
 */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const segments = useSegments() as string[];
  const unread = useUnreadCount();
  if (segments.some((s) => HIDDEN_ON_SEGMENTS.includes(s))) return null;

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]} role="tablist">
      {state.routes.map((route, index) => {
        const focused = index === state.index;
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const badge = route.name === 'avisos' && unread > 0 ? unread : 0;
        const color = focused ? Colors.cream : Colors.navInactive;

        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };

        return (
          <Fragment key={route.key}>
            {index === CREATE_BUTTON_INDEX ? <CreateButton /> : null}
            <Pressable
              onPress={onPress}
              role="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={`${options.tabBarAccessibilityLabel ?? label}${badge ? `, ${badge} não lidos` : ''}`}
              testID={options.tabBarButtonTestID}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
              <View>
                <Icon name={TAB_ICONS[route.name] ?? 'home'} color={color} />
                {badge ? (
                  <View style={styles.badge}>
                    <AppText style={styles.badgeText} color={Colors.paper} maxFontSizeMultiplier={1}>
                      {badge > 9 ? '9+' : badge}
                    </AppText>
                  </View>
                ) : null}
              </View>
              <AppText style={styles.label} color={color} maxFontSizeMultiplier={1.2} numberOfLines={1}>
                {label}
              </AppText>
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}

function CreateButton() {
  return (
    <View style={styles.tab}>
      <Pressable
        onPress={() => router.push('/criar')}
        accessibilityRole="button"
        accessibilityLabel="Criar publicação"
        style={({ pressed }) => [styles.createButton, pressed && styles.createPressed]}>
        <Icon name="plus" color={Colors.paper} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.ink,
    paddingTop: Spacing.one + 2,
    paddingHorizontal: Spacing.one + 2,
  },
  tab: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    lineHeight: 14,
  },
  pressed: {
    opacity: 0.7,
  },
  createButton: {
    width: 56,
    height: 44,
    borderRadius: Radius.xl,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createPressed: {
    backgroundColor: Colors.redPressed,
  },
  badge: {
    position: 'absolute',
    top: -6,
    left: 14,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.ink,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'content-box',
  },
  badgeText: {
    fontFamily: Fonts.extrabold,
    fontSize: 10,
    lineHeight: 12,
  },
});
