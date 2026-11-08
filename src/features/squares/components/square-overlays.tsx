import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

import type * as api from '../api';
import { QUICK_REACTIONS, type MessageAnchor } from './message-row';

/** Ação de folha com ícone colorido: cor no ícone e superfície discreta. */
export function SheetAction({ icon, label, tone = 'ink', disabled = false, onPress }: {
  icon: IconName;
  label: string;
  tone?: 'ink' | 'red';
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed, disabled && styles.sheetRowDisabled]}>
      <View style={[styles.sheetIcon, tone === 'red' ? styles.sheetIconRed : styles.sheetIconInk]}>
        <Icon name={icon} size={19} color={tone === 'red' ? Colors.red : Colors.ink} />
      </View>
      <AppText style={styles.sheetLabel}>{label}</AppText>
      <Icon name="chevronRight" size={18} color={Colors.muted} />
    </Pressable>
  );
}

/** Barra de reações rápidas ancorada na mensagem, com o menu de ações ao final. */
export function ReactionPicker({ message, anchor, insets, onClose, onReact, onMore }: {
  message: api.SquareMessage | null;
  anchor: MessageAnchor | null;
  insets: { top: number; bottom: number; left: number; right: number };
  onClose: () => void;
  onReact: (message: api.SquareMessage, emoji: string) => void;
  onMore: (message: api.SquareMessage) => void;
}) {
  const { width, height } = useWindowDimensions();
  const [pickerHeight, setPickerHeight] = useState(0);
  if (!message || !anchor) return null;
  const margin = Spacing.two;
  const safeTop = insets.top + margin;
  const safeBottom = height - insets.bottom - margin;
  const above = anchor.y - pickerHeight - margin;
  const below = anchor.y + anchor.height + margin;
  const top = above >= safeTop ? above : Math.min(below, Math.max(safeTop, safeBottom - pickerHeight));
  const alignItems = anchor.x + anchor.width / 2 < width / 2 ? 'flex-start' : 'flex-end';
  return <Modal transparent animationType="fade" presentationStyle="overFullScreen" visible onRequestClose={onClose} statusBarTranslucent>
    <View style={styles.pickerOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
      <View pointerEvents="box-none" style={[styles.pickerBounds, { top, left: insets.left + margin, right: insets.right + margin, alignItems }]}>
        <View
          accessibilityLabel="Reações rápidas"
          onLayout={(event) => setPickerHeight(event.nativeEvent.layout.height)}
          style={[styles.pickerBar, pickerHeight === 0 && styles.pickerMeasuring]}>
          {message.viewer.canReact ? QUICK_REACTIONS.map((emoji) => <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`Reagir ${emoji}`} onPress={() => onReact(message, emoji)} style={styles.pickerEmoji}><AppText style={styles.pickerEmojiText}>{emoji}</AppText></Pressable>) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Mais ações da mensagem" onPress={() => onMore(message)} style={styles.pickerMore}><Icon name="more" size={20} /></Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  sheetRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two + 2,
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  sheetRowPressed: {
    backgroundColor: Colors.strawLight,
  },
  sheetRowDisabled: {
    opacity: 0.55,
  },
  sheetIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetIconInk: {
    backgroundColor: Colors.strawLight,
  },
  sheetIconRed: {
    backgroundColor: Colors.redSoft,
  },
  sheetLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.extrabold,
    fontSize: 14.5,
    lineHeight: 19,
  },
  pickerOverlay: { flex: 1 },
  pickerBounds: { position: 'absolute' },
  pickerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.one,
    backgroundColor: Colors.paper,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
    boxShadow: '0 5px 16px rgba(0,0,0,0.18)',
  },
  pickerMeasuring: { opacity: 0 },
  pickerEmoji: {
    width: 40,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerEmojiText: {
    fontSize: 22,
    lineHeight: 30,
  },
  pickerMore: {
    width: 44,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
