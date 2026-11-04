import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { Fonts, MaxContentWidth } from '@/constants/theme';
import { useAccount } from '@/features/account/account-context';
import { getLegalDocument, type LegalBlock, type LegalSection } from '@/features/legal/legal-documents';
import { LegalPaint as P, LegalRedShadow } from '@/features/legal/legal-theme';
import { openSupportMail } from '@/features/legal/support';
import { goBack } from '@/lib/routes';

const INLINE_TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

/**
 * Documento legal (Regras, Termos, Privacidade e avisos): barra fixa com a origem,
 * título do documento, seções numeradas e card de suporte. O conteúdo vem dos dados.
 */
export function LegalDocumentPage({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { account } = useAccount();
  const document = getLegalDocument(id);

  const openSupport = () => {
    // Com sessão, o suporte é a tela interna; sem sessão, o e-mail é a única porta.
    if (account) {
      router.push('/conta/contato' as never);
      return;
    }
    void openSupportMail('Suporte · Popularia').then((opened) => {
      if (!opened) toast.show('Não foi possível abrir o aplicativo de e-mail.');
    });
  };

  return (
    <Screen edges={['left', 'right']} backgroundColor={P.bg}>
      <View style={[styles.bar, { paddingTop: Math.max(insets.top + 10, 54) }]}>
        <View style={styles.barRow}>
          <IconButton icon="back" size={22} accessibilityLabel="Voltar" onPress={goBack} color={P.ink} />
          <AppText style={styles.barLabel}>{document?.backLabel ?? 'Sobre e legal'}</AppText>
        </View>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
        {document ? (
          <>
            <AppText style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
              {document.title}
            </AppText>
            <AppText style={styles.intro}>{document.intro}</AppText>

            {document.sections.map((section, index) => (
              <Section key={section.title} section={section} index={index} />
            ))}

            <SupportCard onPress={openSupport} />
          </>
        ) : (
          <AppText style={styles.intro}>Documento não encontrado.</AppText>
        )}
      </ScrollView>
    </Screen>
  );
}

function Section({ section, index }: { section: LegalSection; index: number }) {
  return (
    <View style={[styles.section, index === 0 && styles.sectionFirst]}>
      <View style={styles.sectionRow}>
        <AppText style={styles.sectionNumber}>{String(index + 1).padStart(2, '0')}</AppText>
        <AppText style={styles.sectionTitle} accessibilityRole="header">{section.title}</AppText>
      </View>
      <View style={styles.blocks}>
        {section.blocks.map((block, blockIndex) => (
          <Block key={`${section.title}-${blockIndex}`} block={block} />
        ))}
      </View>
    </View>
  );
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.type) {
    case 'paragraph':
      return <InlineText text={block.text} style={styles.paragraph} />;

    case 'list':
      return (
        <View style={styles.list}>
          {block.items.map((item) => (
            <View key={item} style={styles.listItem}>
              <View style={styles.listMarker} />
              <InlineText text={item} style={styles.listText} />
            </View>
          ))}
        </View>
      );

    case 'chips_no':
    case 'chips':
    case 'chips_private': {
      const privateChips = block.type === 'chips_private';
      return (
        <View style={styles.chips} accessible accessibilityLabel={block.items.join(', ')}>
          {block.items.map((item) => (
            <View key={item} style={[styles.chip, privateChips && styles.chipPrivate]}>
              {block.type === 'chips_no' ? <Icon name="close" size={11} color={P.red} strokeWidth={3.6} /> : null}
              {privateChips ? <Icon name="lock" size={12} color={P.surface} strokeWidth={2.8} /> : null}
              <AppText style={[styles.chipText, privateChips && styles.chipTextPrivate]}>{item}</AppText>
            </View>
          ))}
        </View>
      );
    }

    case 'path': {
      const spoken = [block.label, ...block.segments.map((segment) => (segment.kind === 'arrow' ? '→' : segment.text))].join(' ');
      return (
        <View style={styles.path} accessible accessibilityLabel={spoken}>
          <AppText style={styles.pathText}>{block.label}</AppText>
          {block.segments.map((segment, index) => {
            if (segment.kind === 'arrow') {
              return <Icon key={`arrow-${index}`} name="arrowRight" size={14} color={P.ink} strokeWidth={3} />;
            }
            if (segment.kind === 'text') {
              return <AppText key={`text-${index}`} style={styles.pathText}>{segment.text}</AppText>;
            }
            return (
              <View key={`chip-${index}`} style={[styles.pathChip, segment.danger && styles.pathChipDanger]}>
                <AppText style={[styles.pathChipText, segment.danger && styles.pathChipTextDanger]}>{segment.text}</AppText>
              </View>
            );
          })}
        </View>
      );
    }

    case 'notice':
      return (
        <View style={styles.notice}>
          <View style={styles.noticeIcon}>
            <Icon name="info" size={20} color={P.ink} strokeWidth={2.4} />
          </View>
          <InlineText text={block.text} style={styles.noticeText} />
        </View>
      );

    case 'alert':
      return (
        <View style={styles.alert}>
          {block.title ? <AppText style={styles.alertTitle}>{block.title}</AppText> : null}
          <InlineText text={block.text} style={styles.alertText} />
        </View>
      );

    case 'highlight':
      return (
        <View style={styles.highlight}>
          <InlineText text={block.text} style={styles.highlightText} />
        </View>
      );

    case 'link_card':
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={block.label}
          onPress={() => router.push({ pathname: '/documento-legal/[id]', params: { id: block.documentId } } as never)}
          style={({ pressed }) => [styles.linkCard, pressed && styles.pressed]}>
          <AppText style={styles.linkCardText}>{block.label}</AppText>
          <Icon name="chevronRight" size={16} color={P.ink} />
        </Pressable>
      );
  }
}

function SupportCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ficou com dúvida? Fale com o suporte"
      onPress={onPress}
      style={({ pressed }) => [styles.support, pressed && styles.supportPressed]}>
      <View style={styles.supportCopy}>
        <AppText style={styles.supportLabel}>Ficou com dúvida?</AppText>
        <AppText style={styles.supportTitle}>Fale com o suporte</AppText>
      </View>
      <Icon name="chevronRight" size={18} color={P.surface} />
    </Pressable>
  );
}

/**
 * Texto com trechos em negrito (`**assim**`) e links (`[texto](https://…)`).
 * Links internos (`/rota`) navegam no app; o resto abre no navegador.
 */
function InlineText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  return (
    <AppText style={style}>
      {text.split(INLINE_TOKEN).map((part, index) => {
        if (!part) return null;
        if (part.startsWith('**') && part.endsWith('**')) {
          return <Text key={index} style={styles.inlineStrong}>{part.slice(2, -2)}</Text>;
        }
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
        if (link) {
          return (
            <Text key={index} accessibilityRole="link" style={styles.inlineLink} onPress={() => openHref(link[2])}>
              {link[1]}
            </Text>
          );
        }
        return <Text key={index}>{part}</Text>;
      })}
    </AppText>
  );
}

function openHref(href: string) {
  if (href.startsWith('/')) {
    router.push(href as never);
    return;
  }
  void Linking.openURL(href).catch(() => {});
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    backgroundColor: P.bg,
    borderBottomWidth: 2,
    borderBottomColor: P.ink,
  },
  barRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  barLabel: {
    flexShrink: 1,
    fontFamily: Fonts.monoSemibold,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: P.secondary,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: 22,
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: Fonts.anton,
    fontSize: 48,
    // Piso de legibilidade do AppText (fontSize + 8) mantém o topo das maiúsculas.
    lineHeight: 56,
    textTransform: 'uppercase',
    color: P.ink,
  },
  intro: {
    marginTop: 12,
    fontFamily: Fonts.regular,
    fontSize: 17,
    lineHeight: 26,
    color: P.subtitle,
  },
  section: {
    marginTop: 24,
    paddingTop: 22,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderTopColor: P.ink,
  },
  sectionFirst: {
    marginTop: 26,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  sectionNumber: {
    fontFamily: Fonts.anton,
    fontSize: 28,
    lineHeight: 36,
    color: P.red,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.anton,
    fontSize: 28,
    lineHeight: 36,
    textTransform: 'uppercase',
    color: P.ink,
  },
  blocks: {
    marginTop: 10,
    gap: 12,
  },
  paragraph: {
    fontFamily: Fonts.regular,
    fontSize: 17,
    lineHeight: 27,
    color: P.ink,
  },
  list: {
    gap: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  listMarker: {
    width: 8,
    height: 8,
    marginTop: 9,
    backgroundColor: P.red,
  },
  listText: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.regular,
    fontSize: 17,
    lineHeight: 26,
    color: P.ink,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 4,
    backgroundColor: P.surface,
  },
  chipPrivate: {
    borderColor: P.ink,
    backgroundColor: P.ink,
  },
  chipText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    lineHeight: 22,
    color: P.ink,
  },
  chipTextPrivate: {
    color: P.surface,
  },
  path: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  pathText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: P.secondary,
  },
  pathChip: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 4,
    backgroundColor: P.surface,
  },
  pathChipDanger: {
    borderColor: P.redText,
  },
  pathChipText: {
    fontFamily: Fonts.extrabold,
    fontSize: 14,
    lineHeight: 22,
    color: P.ink,
  },
  pathChipTextDanger: {
    color: P.redText,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: P.yellow,
  },
  noticeIcon: {
    marginTop: 2,
  },
  noticeText: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: P.ink,
  },
  alert: {
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderLeftWidth: 8,
    borderColor: P.red,
    borderRadius: 6,
    backgroundColor: P.surface,
  },
  alertTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 16,
    lineHeight: 24,
    color: P.redText,
  },
  alertText: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: P.ink,
  },
  highlight: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 6,
    backgroundColor: P.ink,
    boxShadow: `3px 3px 0 ${P.red}`,
  },
  highlightText: {
    fontFamily: Fonts.extrabold,
    fontSize: 18,
    lineHeight: 28,
    color: P.surface,
  },
  linkCard: {
    marginTop: 2,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 6,
    backgroundColor: P.surface,
  },
  linkCardText: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.extrabold,
    fontSize: 15,
    lineHeight: 23,
    color: P.ink,
  },
  pressed: {
    opacity: 0.7,
  },
  support: {
    marginTop: 30,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 6,
    backgroundColor: P.ink,
  },
  supportPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    boxShadow: LegalRedShadow,
  },
  supportCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  supportLabel: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 19,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: P.labelOnDark,
  },
  supportTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 16,
    lineHeight: 24,
    color: P.surface,
  },
  inlineStrong: {
    fontFamily: Fonts.extrabold,
  },
  inlineLink: {
    fontFamily: Fonts.extrabold,
    color: P.redText,
    textDecorationLine: 'underline',
  },
});
