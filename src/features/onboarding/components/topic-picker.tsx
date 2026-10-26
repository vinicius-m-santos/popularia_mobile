import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { TopicGroup, TopicId } from '@/types/models';

type TopicPickerProps = {
  groups: TopicGroup[];
  selected: TopicId[];
  onToggle: (id: TopicId) => void;
};

/** Grupos numerados de assuntos; os escolhidos ficam vermelhos e "saltados" (2b). */
export function TopicPicker({ groups, selected, onToggle }: TopicPickerProps) {
  return (
    <View>
      {groups.map((g, i) => (
        <View key={g.title} style={styles.group}>
          <View style={styles.groupHead} accessibilityRole="header">
            <AppText variant="label" color={Colors.red}>
              {String(i + 1).padStart(2, '0')}
            </AppText>
            <AppText variant="label">{g.title}</AppText>
            <View style={styles.groupRule} />
          </View>
          <View style={styles.chips}>
            {g.topics.map((t) => {
              const on = selected.includes(t.id);
              return (
                <Pressable
                  key={t.id}
                  onPress={() => onToggle(t.id)}
                  role="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={t.label}
                  style={[styles.chip, on && styles.chipOn]}>
                  <View style={[styles.dot, on && styles.dotOn]}>
                    <Icon name={on ? 'check' : 'plus'} size={on ? 13 : 12} color={on ? Colors.red : Colors.ink} />
                  </View>
                  <AppText style={styles.chipLabel} color={on ? Colors.paper : Colors.ink}>
                    {t.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginTop: 22,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two + 2,
  },
  groupRule: {
    flex: 1,
    height: 1.5,
    backgroundColor: Colors.ink,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 9,
    paddingLeft: Spacing.two + 2,
    paddingRight: 14,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
  },
  chipOn: {
    backgroundColor: Colors.red,
    boxShadow: `3px 3px 0 ${Colors.ink}`,
    transform: [{ translateX: -1 }, { translateY: -1 }],
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.straw,
  },
  dotOn: {
    backgroundColor: Colors.paper,
  },
  chipLabel: {
    flexShrink: 1,
    fontFamily: Fonts.bold,
    fontSize: 15,
    lineHeight: 18,
  },
});
