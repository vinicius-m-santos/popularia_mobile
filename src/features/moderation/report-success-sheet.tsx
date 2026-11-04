/**
 * Confirmação da denúncia (mockup de 390 px).
 *
 * Substitui a antiga tela de sucesso: mostra o que foi denunciado, o que acontece
 * agora e oferece bloquear a pessoa sem uma segunda confirmação. O bloqueio vira
 * o próprio estado da linha, com "Desfazer" no lugar da ação.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { findComuna } from '@/features/lookup';
import { Fonts, Spacing } from '@/constants/theme';
import type { ReportTarget } from '@/types/models';

/** Cores exatas do mockup; o papel da folha é mais escuro que o creme das telas. */
const P = {
  bg: '#F2EADB',
  ink: '#15120F',
  red: '#BF3326',
  redText: '#A3261C',
  paper: '#FBF7EF',
  secondary: '#5E554A',
} as const;

const TYPE_LABEL: Record<ReportTarget['kind'], string> = {
  post: 'PUBLICAÇÃO',
  comment: 'COMENTÁRIO',
  profile: 'PERFIL',
  comuna: 'COMUNA',
};

type ReportSuccessSheetProps = {
  target: ReportTarget;
  /** Comuna e conteúdo próprio não oferecem bloqueio. */
  canBlock: boolean;
  /** A pessoa já estava bloqueada antes desta denúncia: a linha desaparece. */
  blockedBefore: boolean;
  /** O bloqueio foi feito nesta folha: a linha vira o estado bloqueado. */
  blockedNow: boolean;
  busy: boolean;
  onBlock: () => void;
  onUndo: () => void;
  onClose: () => void;
  onOpenRules: () => void;
};

function personName(target: ReportTarget): string {
  return target.author.name.trim() || `@${target.author.handle}`;
}

function typeLabel(target: ReportTarget): string {
  return target.kind === 'post' && target.poll ? 'ENQUETE' : TYPE_LABEL[target.kind];
}

function contentTitle(target: ReportTarget): string {
  const fallback = target.kind === 'profile'
    ? personName(target)
    : target.kind === 'comuna'
      ? target.author.name.trim() || `c/ ${target.author.handle}`
      : target.excerpt.trim() || 'Conteúdo sem texto';
  return target.title?.trim() || fallback;
}

function contentOrigin(target: ReportTarget): string | null {
  if (target.kind === 'profile') return `@${target.author.handle}`;
  if (target.kind === 'comuna') return null;
  const name = target.comunaName ?? findComuna(target.comunaId)?.name ?? null;
  return name ? `c/ ${name}` : null;
}

export function ReportSuccessSheet({
  target,
  canBlock,
  blockedBefore,
  blockedNow,
  busy,
  onBlock,
  onUndo,
  onClose,
  onOpenRules,
}: ReportSuccessSheetProps) {
  const name = personName(target);
  const origin = contentOrigin(target);
  const showBlock = canBlock && (blockedNow || !blockedBefore);

  return (
    <View accessibilityViewIsModal importantForAccessibility="yes">
      <View style={styles.topRow}>
        <View style={styles.checkSquare} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon name="check" size={26} color={P.bg} strokeWidth={3} />
        </View>
        <View style={styles.stampOuter} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.stampInner}>
            <AppText style={styles.stampText} maxFontSizeMultiplier={1.2}>RECEBIDA</AppText>
          </View>
        </View>
      </View>

      <AppText style={styles.title} accessibilityRole="header">DENÚNCIA ENVIADA.</AppText>
      <AppText style={styles.lead} color={P.secondary}>
        Valeu por avisar. A moderação vai analisar o conteúdo com base nas{' '}
        <AppText
          style={styles.leadLink}
          onPress={onOpenRules}
          accessibilityRole="link"
          accessibilityLabel="Abrir as Regras da Comunidade">
          Regras da Comunidade
        </AppText>
        .
      </AppText>

      <View
        style={styles.contentCard}
        accessible
        accessibilityLabel={`Conteúdo denunciado: ${typeLabel(target)}, ${contentTitle(target)}${origin ? `, ${origin}` : ''}`}>
        <View style={styles.typeTag}>
          <AppText style={styles.typeTagText} color={P.paper} maxFontSizeMultiplier={1.3}>{typeLabel(target)}</AppText>
        </View>
        <AppText style={styles.contentTitle} numberOfLines={1} ellipsizeMode="tail">{contentTitle(target)}</AppText>
        {origin ? <AppText style={styles.contentOrigin} numberOfLines={1}>{origin}</AppText> : null}
      </View>

      <View style={styles.points}>
        <View style={styles.point}>
          <AppText style={styles.pointNumber}>01</AppText>
          <AppText style={styles.pointText}>A pessoa não fica sabendo quem denunciou.</AppText>
        </View>
        <View style={styles.point}>
          <AppText style={styles.pointNumber}>02</AppText>
          <AppText style={styles.pointText}>Se o conteúdo quebrar as regras, ele sai do ar.</AppText>
        </View>
      </View>

      {showBlock ? (
        <View style={styles.actionBlock}>
          {blockedNow ? (
            <View style={styles.blockRow} accessibilityLiveRegion="polite">
              <View style={styles.blockedIcon}>
                <Icon name="check" size={20} color={P.bg} strokeWidth={3} />
              </View>
              <View style={styles.blockCopy}>
                <AppText style={styles.blockedTitle}>{name} foi bloqueado</AppText>
                <AppText style={styles.blockDescription}>Dá pra desfazer em Conta › Bloqueios</AppText>
              </View>
              <Pressable
                onPress={onUndo}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`Desfazer bloqueio de ${name}`}
                accessibilityState={{ disabled: busy }}
                style={({ pressed }) => [styles.undo, pressed && styles.undoPressed]}>
                <AppText style={styles.undoText} color={P.ink}>Desfazer</AppText>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={onBlock}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`Bloquear ${name}`}
              accessibilityHint="Bloqueia a pessoa sem pedir confirmação"
              accessibilityState={{ disabled: busy }}
              style={({ pressed }) => [styles.blockRow, pressed && styles.blockRowPressed]}>
              <View style={styles.blockIcon}>
                <Icon name="block" size={20} color={P.redText} strokeWidth={2.4} />
              </View>
              <View style={styles.blockCopy}>
                <AppText style={styles.blockTitle}>Bloquear {name}</AppText>
                <AppText style={styles.blockDescription}>Vocês param de ver o conteúdo um do outro.</AppText>
              </View>
              <Icon name="chevronRight" size={18} color={P.ink} strokeWidth={2.6} />
            </Pressable>
          )}
        </View>
      ) : null}

      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Entendi"
        style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}>
        <AppText style={styles.doneLabel} color={P.bg}>ENTENDI</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    marginTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  checkSquare: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 6,
    backgroundColor: P.ink,
    shadowColor: P.red,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  stampOuter: {
    marginTop: 6,
    padding: 1,
    borderWidth: 2,
    borderColor: P.red,
    borderRadius: 6,
    transform: [{ rotate: '-6deg' }],
  },
  stampInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderColor: P.red,
    borderRadius: 3,
  },
  stampText: {
    fontFamily: Fonts.anton,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: P.red,
  },
  title: {
    marginTop: 16,
    fontFamily: Fonts.anton,
    fontSize: 38,
    lineHeight: 46,
    textTransform: 'uppercase',
    color: P.ink,
  },
  lead: {
    marginTop: 8,
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  leadLink: {
    fontFamily: Fonts.bold,
    textDecorationLine: 'underline',
    color: P.ink,
  },
  contentCard: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: P.ink,
    borderRadius: 6,
  },
  typeTag: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    backgroundColor: P.ink,
  },
  typeTagText: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  contentTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.bold,
    fontSize: 14,
    lineHeight: 20,
    color: P.ink,
  },
  contentOrigin: {
    flexShrink: 0,
    maxWidth: '38%',
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 17,
    color: P.secondary,
  },
  points: {
    marginTop: 14,
    gap: 8,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  pointNumber: {
    width: 20,
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 17,
    color: P.redText,
  },
  pointText: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: P.ink,
  },
  actionBlock: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 2,
    borderTopColor: P.ink,
  },
  blockRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  blockRowPressed: {
    opacity: 0.7,
  },
  blockIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: P.redText,
    borderRadius: 6,
  },
  blockCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  blockTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: P.redText,
  },
  blockDescription: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: P.secondary,
  },
  blockedIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 6,
    backgroundColor: P.ink,
  },
  blockedTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: P.ink,
  },
  undo: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  undoPressed: {
    opacity: 0.6,
  },
  undoText: {
    fontFamily: Fonts.extrabold,
    fontSize: 14,
    lineHeight: 20,
    textDecorationLine: 'underline',
  },
  doneButton: {
    marginTop: 14,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 6,
    backgroundColor: P.ink,
  },
  doneButtonPressed: {
    opacity: 0.85,
  },
  doneLabel: {
    fontFamily: Fonts.anton,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 0.88,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
