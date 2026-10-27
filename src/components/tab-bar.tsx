import { router, useSegments } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Fragment, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
import { Icon, type IconName } from '@/components/icon';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

/** Ícone de cada rota de aba; o nome da rota é o nome do arquivo em `src/app/(tabs)`. */
const TAB_ICONS: Record<string, IconName> = {
  '(inicio)': 'home',
  explorar: 'search',
  pracas: 'comment',
  perfil: 'user',
};

/** Posição do botão "Criar" entre as abas, como no design. */
const CREATE_BUTTON_INDEX = 2;

/** Na discussão a barra some para dar lugar ao campo de comentário (design 1c). */
const HIDDEN_ON_SEGMENTS = ['post'];

/**
 * Barra inferior escura do design: quatro abas e o botão vermelho de criar
 * no centro, que abre o menu de criação.
 */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const segments = useSegments() as string[];
  if (segments.some((s) => HIDDEN_ON_SEGMENTS.includes(s))) return null;

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]} role="tablist">
      {state.routes.map((route, index) => {
        const focused = index === state.index;
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
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
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              testID={options.tabBarButtonTestID}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
              <View>
                <Icon name={TAB_ICONS[route.name] ?? 'home'} color={color} />
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
  const [menuVisible, setMenuVisible] = useState(false);
  const menuOpen = useRef(false);

  const openMenu = () => {
    if (menuOpen.current) return;
    menuOpen.current = true;
    setMenuVisible(true);
  };
  const closeMenu = () => {
    menuOpen.current = false;
    setMenuVisible(false);
  };

  const navigateTo = (route: '/criar' | '/criar-comuna' | '/biblioteca/enviar') => {
    if (!menuOpen.current) return;
    closeMenu();
    router.push(route);
  };

  return (
    <View style={styles.tab}>
      <Pressable
        onPress={openMenu}
        accessibilityRole="button"
        accessibilityLabel="Criar"
        style={({ pressed }) => [styles.createButton, pressed && styles.createPressed]}>
        <Icon name="plus" color={Colors.paper} />
      </Pressable>
      <BottomSheet visible={menuVisible} onClose={closeMenu} title="O que você quer criar?">
        <CreateMenuItem
          icon="image"
          title="Publicação"
          description="Compartilhe uma ideia, imagem ou enquete."
          onPress={() => navigateTo('/criar')}
        />
        <CreateMenuItem icon="bookmark" title="Adicionar PDF" description="Guarde um PDF na sua biblioteca e escolha quem pode abrir." onPress={() => navigateTo('/biblioteca/enviar')} />
        <CreateMenuItem
          icon="support"
          title="Comuna"
          description="Crie uma comunidade e reúna pessoas."
          onPress={() => navigateTo('/criar-comuna')}
        />
      </BottomSheet>
    </View>
  );
}

type MenuItemProps = {
  icon: IconName;
  title: string;
  description: string;
  onPress: () => void;
};

function CreateMenuItem({ icon, title, description, onPress }: MenuItemProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
      <View style={styles.menuItemIcon}>
        <Icon name={icon} color={Colors.ink} size={22} />
      </View>
      <View style={styles.menuItemContent}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption">{description}</AppText>
      </View>
      <Icon name="arrowRight" color={Colors.muted} size={20} />
    </Pressable>
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.lg,
  },
  menuItemPressed: {
    backgroundColor: Colors.strawLight,
  },
  menuItemIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.straw,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemContent: {
    flex: 1,
    gap: 2,
  },
});
