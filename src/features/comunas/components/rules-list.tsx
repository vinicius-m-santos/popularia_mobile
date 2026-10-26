import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { ComunaRule, User } from '@/types/models';

type RulesListProps = {
  rules: ComunaRule[];
  moderationNote: string;
  moderators: User[];
};

/** Regras numeradas e o quadro "Moderação eleita". */
export function RulesList({ rules, moderationNote, moderators }: RulesListProps) {
  return (
    <View style={styles.wrap}>
      {rules.map((rule, i) => (
        <View
          key={rule.title}
          style={styles.rule}
          accessible
          accessibilityLabel={`Regra ${i + 1}: ${rule.title}. ${rule.description}`}>
          <AppText style={styles.number} color={Colors.red} maxFontSizeMultiplier={1.2}>
            {String(i + 1).padStart(2, '0')}
          </AppText>
          <View style={styles.ruleText}>
            <AppText style={styles.ruleTitle}>{rule.title}</AppText>
            <AppText style={styles.ruleDescription} color={Colors.inkSoft}>
              {rule.description}
            </AppText>
          </View>
        </View>
      ))}

      <View style={styles.modBox}>
        <View style={styles.modHeader}>
          <Icon name="shield" size={22} color={Colors.red} />
          <AppText variant="heading" style={styles.modTitle} accessibilityRole="header">
            {moderationNote ? 'Moderação eleita' : 'Moderação'}
          </AppText>
        </View>
        {moderationNote ? (
          <AppText style={styles.modNote} color={Colors.inkSoft}>
            {moderationNote}
          </AppText>
        ) : null}
        <View style={styles.mods}>
          {moderators.map((m) => (
            <View key={m.id} style={styles.mod}>
              <Avatar initials={m.initials} tone={m.tone} size={30} />
              <AppText style={styles.modName}>{m.name}</AppText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.seven,
  },
  rule: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: Spacing.four,
    borderBottomWidth: 1,
    borderBottomColor: Colors.rule,
  },
  number: {
    width: 34,
    fontFamily: Fonts.condensed,
    fontSize: 38,
    lineHeight: 46,
  },
  ruleText: {
    flex: 1,
  },
  ruleTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 16,
    lineHeight: 21,
  },
  ruleDescription: {
    fontSize: 14.5,
    lineHeight: 21,
    marginTop: 3,
  },
  modBox: {
    marginTop: Spacing.five,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    borderRadius: Radius.xl,
    padding: 14,
    gap: Spacing.three,
    backgroundColor: Colors.paper,
  },
  modHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  modTitle: {
    fontSize: 19,
  },
  modNote: {
    fontSize: 14,
    lineHeight: 20,
  },
  mods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
  },
  mod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  modName: {
    fontFamily: Fonts.bold,
    fontSize: 13.5,
    lineHeight: 18,
  },
});
