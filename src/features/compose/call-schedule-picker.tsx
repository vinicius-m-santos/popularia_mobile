import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { pickerDateToWallStrings, wallStringsToPickerDate } from '@/features/events/date-picker-field';

type Props = {
  visible: boolean;
  date: string;
  time: string;
  onClose: () => void;
  onConfirm: (date: string, time: string) => void;
};

/** Um único compromisso: data + hora, sem horário de fim. */
export function CallSchedulePicker({ visible, date, time, onClose, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const initial = wallStringsToPickerDate(date, time) ?? new Date();
  const [pending, setPending] = useState(initial);
  const [stage, setStage] = useState<'date' | 'time'>('date');
  const [webDate, setWebDate] = useState(() => pickerDateToWallStrings(initial).dateStr);
  const [webTime, setWebTime] = useState(() => pickerDateToWallStrings(initial).timeStr);

  const commit = (value: Date) => {
    const wall = pickerDateToWallStrings(value);
    onConfirm(wall.dateStr, wall.timeStr);
    onClose();
  };

  if (!visible) return null;

  if (Platform.OS === 'android') {
    return stage === 'date' ? (
      <DateTimePicker value={pending} mode="date" display="default" locale="pt-BR" onChange={(event: DateTimePickerEvent, selected?: Date) => {
        if (event.type === 'dismissed' || !selected) { onClose(); return; }
        setPending(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), pending.getHours(), pending.getMinutes()));
        setStage('time');
      }} />
    ) : (
      <DateTimePicker value={pending} mode="time" display="default" locale="pt-BR" onChange={(event: DateTimePickerEvent, selected?: Date) => {
        if (event.type === 'dismissed' || !selected) { onClose(); return; }
        commit(new Date(pending.getFullYear(), pending.getMonth(), pending.getDate(), selected.getHours(), selected.getMinutes()));
      }} />
    );
  }

  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.four) }]}>
        <View style={styles.header}>
          <AppText variant="label">Quando</AppText>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar seletor"><AppText style={styles.cancel}>Fechar</AppText></Pressable>
        </View>
        {Platform.OS === 'web' ? <View style={styles.webFields}>
          <View style={styles.webField}><AppText variant="label">Data</AppText><TextInput value={webDate} onChangeText={setWebDate} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.placeholder} style={styles.webInput} accessibilityLabel="Data do chamado" /></View>
          <View style={styles.webField}><AppText variant="label">Hora</AppText><TextInput value={webTime} onChangeText={setWebTime} placeholder="HH:MM" placeholderTextColor={Colors.placeholder} style={styles.webInput} accessibilityLabel="Hora do chamado" /></View>
        </View> : <>
          <DateTimePicker value={pending} mode="date" display="spinner" locale="pt-BR" onChange={(_event, selected) => {
            if (selected) setPending(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), pending.getHours(), pending.getMinutes()));
          }} />
          <DateTimePicker value={pending} mode="time" display="spinner" locale="pt-BR" onChange={(_event, selected) => {
            if (selected) setPending(new Date(pending.getFullYear(), pending.getMonth(), pending.getDate(), selected.getHours(), selected.getMinutes()));
          }} />
        </>}
        <Pressable onPress={() => {
          if (Platform.OS === 'web') {
            const value = wallStringsToPickerDate(webDate, webTime);
            if (value) commit(value);
            return;
          }
          commit(pending);
        }} accessibilityRole="button" accessibilityLabel="Confirmar horário" style={({ pressed }) => [styles.confirm, pressed && styles.pressed]}>
          <AppText style={styles.confirmLabel} color={Colors.paper}>Confirmar</AppText>
        </Pressable>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(22,18,15,0.55)' },
  sheet: { backgroundColor: Colors.paper, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: Spacing.five, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancel: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.muted, textDecorationLine: 'underline' },
  webFields: { flexDirection: 'row', gap: Spacing.two },
  webField: { flex: 1, gap: Spacing.one },
  webInput: { minHeight: 50, borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.cream, paddingHorizontal: Spacing.three, fontFamily: Fonts.regular, fontSize: 16, color: Colors.ink },
  confirm: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm, backgroundColor: Colors.red, borderWidth: 2, borderColor: Colors.ink },
  confirmLabel: { fontFamily: Fonts.extrabold, fontSize: 15, lineHeight: 20 },
  pressed: { opacity: 0.7 },
});
