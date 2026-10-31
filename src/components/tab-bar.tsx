import { router, useSegments } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Fragment, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
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
  const { width } = useWindowDimensions();
  // A arte encosta na borda direita, como no desenho; em telas estreitas ela
  // encolhe mantendo a borda esquerda na guia de 204.
  const artWidth = Math.min(186, Math.max(120, width - 204));
  const artHeight = Math.round(artWidth * (192 / 186));

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
      <BottomSheet visible={menuVisible} onClose={closeMenu} appearance="creation">
        <View style={styles.createMenu}>
          <View style={styles.createIntro}>
            <View style={styles.createIntroCopy}>
              <AppText variant="display" accessibilityRole="header" style={styles.createTitle}>O que você{`\n`}quer criar?</AppText>
              <AppText variant="caption" style={styles.createSubtitle}>Compartilhe ideias, organize conteúdos e fortaleça sua comuna.</AppText>
            </View>
            <View style={[styles.createIntroArt, { width: artWidth, height: artHeight }]}>
              <CreationIllustration asset="hero" contentFit="cover" style={styles.createIntroArtImage} />
            </View>
          </View>
          <View style={styles.createNav}>
            <CreateMenuItem
              title="Publicação"
              description="Post, chamado ou enquete — sobre o que quiser."
              image="publication"
              onPress={() => navigateTo('/criar')}
            />
            <CreateMenuItem title="Adicionar PDF" description="Guarde na sua biblioteca e escolha quem pode abrir." image="pdf" onPress={() => navigateTo('/biblioteca/enviar')} />
            <CreateMenuItem
              title="Comuna"
              description="Crie uma comunidade e reúna pessoas."
              image="comuna"
              onPress={() => navigateTo('/criar-comuna')}
            />
          </View>
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
        <AppText variant="bodyStrong" style={styles.menuItemTitle}>{title}</AppText>
        <AppText variant="caption" style={styles.menuItemDescription}>{description}</AppText>
      </View>
      <Icon name="chevronRight" color={Colors.ink} size={20} />
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
    gap: 0,
  },
  createIntro: {
    position: 'relative',
    minHeight: 200,
    overflow: 'hidden',
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  createIntroCopy: {
    maxWidth: 210,
    gap: Spacing.three,
    zIndex: 1,
  },
  createTitle: {
    fontFamily: Fonts.anton,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: 0.44,
  },
  createSubtitle: {
    color: Colors.muted,
    fontSize: 15,
    lineHeight: 21,
  },
  createIntroArt: {
    position: 'absolute',
    top: 6,
    right: 0,
    backgroundColor: Colors.paper,
    overflow: 'hidden',
  },
  createIntroArtImage: {
    width: '100%',
    height: '100%',
  },
  createNav: {
    gap: Spacing.three,
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  menuItem: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.md,
    backgroundColor: Colors.paper,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 10,
    paddingRight: Spacing.three,
    shadowColor: Colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  menuItemPressed: {
    backgroundColor: Colors.strawLight,
  },
  menuItemImageFrame: {
    width: 80,
    height: 80,
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: Radius.sm,
    backgroundColor: Colors.straw,
  },
  menuItemImage: {
    width: '100%',
    height: '100%',
  },
  menuItemContent: {
    flex: 1,
    gap: 3,
  },
  menuItemTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 18,
    lineHeight: 22,
  },
  menuItemDescription: {
    color: Colors.muted,
    fontSize: 14,
    lineHeight: 19,
  },
});
