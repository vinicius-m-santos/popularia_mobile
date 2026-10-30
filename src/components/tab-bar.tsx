import { router, useSegments } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Fragment, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CreationIllustration, type CreationAsset } from '@/features/media/creation-assets';

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
      <BottomSheet visible={menuVisible} onClose={closeMenu}>
        <View style={styles.createMenu}>
          <View style={styles.createIntro}>
            <View style={styles.createIntroCopy}>
              <AppText variant="display" accessibilityRole="header" style={styles.createTitle}>O que você{`\n`}quer criar?</AppText>
              <AppText variant="label" style={styles.createSubtitle}>Compartilhe ideias, organize conteúdos e fortaleça sua comuna.</AppText>
            </View>
            <CreationIllustration asset="hero" contentFit="contain" style={styles.createIntroArt} />
          </View>
        <CreateMenuItem
          title="Publicação"
          description="Compartilhe uma ideia, imagem ou enquete."
          image="publication"
          onPress={() => navigateTo('/criar')}
        />
        <CreateMenuItem title="Adicionar PDF" description="Guarde um PDF na sua biblioteca e escolha quem pode abrir." image="pdf" onPress={() => navigateTo('/biblioteca/enviar')} />
        <CreateMenuItem
          title="Comuna"
          description="Crie uma comunidade e reúna pessoas."
          image="comuna"
          onPress={() => navigateTo('/criar-comuna')}
        />
        </View>
      </BottomSheet>
    </View>
  );
}

type MenuItemProps = {
  title: string;
  description: string;
  image: CreationAsset;
  onPress: () => void;
};

function CreateMenuItem({ title, description, image, onPress }: MenuItemProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
      <View style={styles.menuItemImageFrame}><CreationIllustration asset={image} contentFit="cover" style={styles.menuItemImage} /></View>
      <View style={styles.menuItemContent}>
        <AppText variant="heading" style={styles.menuItemTitle}>{title}</AppText>
        <AppText variant="label" style={styles.menuItemDescription}>{description}</AppText>
      </View>
      <Icon name="arrowRight" color={Colors.ink} size={26} />
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
  createMenu: {
    gap: Spacing.three,
    paddingBottom: Spacing.one,
  },
  createIntro: {
    minHeight: 164,
    flexDirection: 'row',
    overflow: 'hidden',
    alignItems: 'stretch',
  },
  createIntroCopy: {
    flex: 1.1,
    justifyContent: 'center',
    zIndex: 1,
  },
  createTitle: {
    fontFamily: Fonts.anton,
    fontSize: 40,
    lineHeight:60,
    letterSpacing: -0.5,
  },
  createSubtitle: {
    maxWidth: 235,
    color: Colors.inkSoft,
    fontSize: 10,
    lineHeight: 15,
  },
  createIntroArt: {
    position: 'absolute',
    right: -30,
    bottom: -20,
    width: 196,
    height: 196,
  },
  menuItem: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 2,
    borderColor: Colors.ink,
    padding: Spacing.two,
  },
  menuItemPressed: {
    backgroundColor: Colors.strawLight,
  },
  menuItemImageFrame: {
    width: 82,
    height: 82,
    overflow: 'hidden',
    backgroundColor: Colors.straw,
  },
  menuItemImage: {
    width: '100%',
    height: '100%',
  },
  menuItemContent: {
    flex: 1,
    gap: Spacing.one,
  },
  menuItemTitle: {
    fontFamily: Fonts.anton,
    fontSize: 28,
    lineHeight: 38,
  },
  menuItemDescription: {
    color: Colors.inkSoft,
    fontSize: 10.5,
    lineHeight: 15,
    letterSpacing: 0.3,
  },
});
