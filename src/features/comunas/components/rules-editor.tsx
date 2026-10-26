import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { TextField } from '@/components/text-field';
import { Colors, Fonts, Spacing } from '@/constants/theme';

import type { ComunaRuleInput } from '../api';

export const MAX_RULES = 10;
export const RULE_TITLE_MAX = 120;
export const RULE_BODY_MAX = 500;

type RulesEditorProps = {
  rules: ComunaRuleInput[];
  onChange: (rules: ComunaRuleInput[]) => void;
  /** Mensagem de erro do servidor para a lista (por exemplo, `rules[0].title`). */
  error?: string;
};

/** Regras numeradas editáveis (criar e gerir comuna): título, explicação e remover. */
export function RulesEditor({ rules, onChange, error }: RulesEditorProps) {
  const update = (index: number, patch: Partial<ComunaRuleInput>) =>
    onChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  return (
    <View style={styles.wrap}>
      {rules.map((rule, i) => (
        <View key={i} style={styles.rule}>
          <View style={styles.ruleHeader}>
            <AppText style={styles.number} color={Colors.red} maxFontSizeMultiplier={1.2}>
              {String(i + 1).padStart(2, '0')}
            </AppText>
            <Pressable
              onPress={() => onChange(rules.filter((_, j) => j !== i))}
              accessibilityRole="button"
              accessibilityLabel={`Remover regra ${i + 1}`}
              hitSlop={8}
              style={styles.remove}>
              <AppText style={styles.removeLabel} color={Colors.red}>
                Remover
              </AppText>
            </Pressable>
          </View>
          <TextField
            label={`Título da regra ${i + 1}`}
            value={rule.title}
            onChangeText={(title) => update(i, { title })}
            maxLength={RULE_TITLE_MAX}
            placeholder="Ex.: Respeito sempre"
          />
          <TextField
            label="Explicação"
            labelAside="opcional"
            value={rule.body}
            onChangeText={(body) => update(i, { body })}
            maxLength={RULE_BODY_MAX}
            multiline
            placeholder="O que vale e o que acontece se não for cumprida"
          />
        </View>
      ))}
      {rules.length < MAX_RULES ? (
        <Pressable
          onPress={() => onChange([...rules, { title: '', body: '' }])}
          accessibilityRole="button"
          style={({ pressed }) => [styles.add, pressed && styles.pressed]}>
          <AppText style={styles.addLabel}>+ Adicionar regra</AppText>
        </Pressable>
      ) : (
        <AppText variant="caption">Limite de {MAX_RULES} regras.</AppText>
      )}
      {error ? (
        <AppText style={styles.error} color={Colors.red} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

/** Regras sem título são descartadas; o resto vai como está (o servidor normaliza e valida). */
export function cleanRules(rules: ComunaRuleInput[]): ComunaRuleInput[] {
  return rules.filter((r) => r.title.trim() !== '').map((r) => ({ title: r.title.trim(), body: r.body.trim() }));
}

/** Primeira mensagem do servidor sobre as regras (`rules[2].title` etc.). */
export function rulesViolation(violations: Record<string, string>): string | undefined {
  const key = Object.keys(violations).find((k) => k.startsWith('rules'));
  return key ? violations[key] : undefined;
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.four,
  },
  rule: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
    borderBottomWidth: 1,
    borderBottomColor: Colors.rule,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  number: {
    fontFamily: Fonts.condensed,
    fontSize: 28,
    lineHeight: 30,
  },
  remove: {
    minHeight: 32,
    justifyContent: 'center',
  },
  removeLabel: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    lineHeight: 17,
  },
  add: {
    minHeight: 44,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.ink,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: {
    fontFamily: Fonts.extrabold,
    fontSize: 14,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.75,
  },
  error: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    lineHeight: 17,
  },
});
