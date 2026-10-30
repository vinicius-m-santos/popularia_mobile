import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, Spacing } from '@/constants/theme';

type DatePickerFieldProps = {
  label: string;
  labelAside?: string;
  mode: 'date' | 'time';
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  disabled?: boolean;
};

/** Formats a Date for display. Exported for use in tests. */
export function formatPickerDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export function formatPickerTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Converts wall-clock strings (DD/MM/YYYY and HH:MM) to a Date in local device time.
 * Used to initialize the picker with the value coming from an existing EventDraft.
 */
export function wallStringsToPickerDate(dateStr: string, timeStr: string): Date | null {
  const dayMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr.trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeStr.trim());
  if (!dayMatch || !timeMatch) return null;
  const day = Number(dayMatch[1]);
  const month = Number(dayMatch[2]);
  const year = Number(dayMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || day < 1 || year < 2000) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;
  const d = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Converts a picker Date to wall-clock strings the EventDraft format expects. */
export function pickerDateToWallStrings(date: Date): { dateStr: string; timeStr: string } {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return { dateStr: `${day}/${month}/${year}`, timeStr: `${hour}:${minute}` };
}

/**
 * Field that looks like a TextField (editorial appearance) but opens the native date or time picker.
 * On Android the system dialog appears directly; on iOS a modal with a spinner is used.
 */
export function DatePickerField({
  label,
  labelAside,
  mode,
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder,
  disabled = false,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  // iOS: track an uncommitted selection while the spinner is open.
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const insets = useSafeAreaInsets();

  const displayValue = value
    ? mode === 'date'
      ? formatPickerDate(value)
      : formatPickerTime(value)
    : null;

  const accessibilityValue = displayValue
    ? `${label}, ${displayValue}, botão`
    : `${label}, não definido, botão`;

  const handleAndroidChange = (_event: DateTimePickerEvent, selected?: Date) => {
    setOpen(false);
    if (selected) onChange(selected);
  };

  const handleIosChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (selected) setPendingDate(selected);
  };

  const confirmIos = () => {
    if (pendingDate) onChange(pendingDate);
    else if (value) onChange(value);
    setOpen(false);
    setPendingDate(null);
  };

  const cancelIos = () => {
    setOpen(false);
    setPendingDate(null);
  };

  const open_ = () => {
    if (disabled) return;
    setPendingDate(value);
    setOpen(true);
  };

  const pickerValue = Platform.OS === 'ios' ? (pendingDate ?? value ?? new Date()) : (value ?? new Date());

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <AppText style={styles.label}>{label}</AppText>
        {labelAside ? <AppText style={styles.aside} color={Colors.muted}>{labelAside}</AppText> : null}
      </View>
      <Pressable
        onPress={open_}
        accessibilityRole="button"
        accessibilityLabel={accessibilityValue}
        style={({ pressed }) => [styles.box, (pressed || open) && !disabled && styles.boxFocused, disabled && styles.boxDisabled]}>
        <AppText
          style={[styles.input, !displayValue && styles.placeholder]}
          color={displayValue ? Colors.ink : Colors.placeholder}
          numberOfLines={1}>
          {displayValue ?? (placeholder ?? (mode === 'date' ? 'Escolher data' : 'Escolher horário'))}
        </AppText>
      </Pressable>

      {/* Android: show the picker directly when open */}
      {Platform.OS === 'android' && open ? (
        <DateTimePicker
          value={pickerValue}
          mode={mode}
          display="default"
          onChange={handleAndroidChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          locale="pt-BR"
        />
      ) : null}

      {/* iOS: show a modal with a spinner picker */}
      {Platform.OS === 'ios' ? (
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={cancelIos}>
          <Pressable style={styles.overlay} onPress={cancelIos} accessibilityRole="button" accessibilityLabel="Fechar" />
          <View style={[styles.iosSheet, { paddingBottom: Math.max(insets.bottom, Spacing.four) }]}>
            <View style={styles.iosHeader}>
              <Pressable onPress={cancelIos} accessibilityRole="button" style={styles.iosAction}>
                <AppText style={styles.iosCancelLabel}>Cancelar</AppText>
              </Pressable>
              <AppText style={styles.iosTitle}>{label}</AppText>
              <Pressable onPress={confirmIos} accessibilityRole="button" style={styles.iosAction}>
                <AppText style={styles.iosConfirmLabel} color={Colors.red}>Confirmar</AppText>
              </Pressable>
            </View>
            <DateTimePicker
              value={pickerValue}
              mode={mode}
              display="spinner"
              onChange={handleIosChange}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              locale="pt-BR"
              style={styles.iosPicker}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  label: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  aside: { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18 },
  box: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
    paddingHorizontal: 14,
  },
  boxFocused: { borderColor: Colors.red },
  boxDisabled: { opacity: 0.5 },
  input: { flex: 1, fontFamily: Fonts.regular, fontSize: 16, lineHeight: 21 },
  placeholder: { fontFamily: Fonts.regular },
  // iOS modal sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  iosSheet: {
    backgroundColor: Colors.paper,
    borderTopWidth: 1.5,
    borderTopColor: Colors.ink,
  },
  iosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E2D6C1',
    paddingHorizontal: Spacing.four,
    minHeight: 52,
  },
  iosTitle: { fontFamily: Fonts.bold, fontSize: 15.5, lineHeight: 20 },
  iosAction: { minWidth: 72, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  iosCancelLabel: { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 21, color: Colors.muted },
  iosConfirmLabel: { fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 21 },
  iosPicker: { height: 200 },
});
