import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Colors, Fonts, Radius, Shadows, Spacing } from '@/constants/theme';
import { POLL_MAX_OPTIONS, POLL_OPTION_MAX, POLL_QUESTION_MAX, type PollDraft } from '@/features/posts/poll';

/** Formulário da enquete: pergunta, opções e o cartão com a linguagem do rascunho. */
export function PollComposerCard({ poll, publishing, onChange }: {
  poll: PollDraft;
  publishing: boolean;
  onChange: (update: (current: PollDraft) => PollDraft) => void;
}) {
  // A chave da próxima opção continua de onde o rascunho parou, mesmo se o
  // formulário for desmontado ao alternar para Chamado e voltar.
  const optionSeq = useRef(poll.options.reduce((max, option) => {
    const match = /^option-(\d+)$/.exec(option.key);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 2));

  return <View style={styles.pollShadow}>
    <View style={styles.pollCard}>
      <View style={styles.pollHeader}>
        <AppText variant="label" color={Colors.paper}>Enquete</AppText>
        <AppText style={styles.pollCount} color={Colors.onInkMuted}>{poll.options.length}/{POLL_MAX_OPTIONS} opções</AppText>
      </View>
      <View style={styles.pollBody}>
        <TextInput
          value={poll.question}
          onChangeText={(question) => onChange((current) => ({ ...current, question }))}
          maxLength={POLL_QUESTION_MAX}
          placeholder="Qual a pergunta?"
          placeholderTextColor={Colors.placeholder}
          accessibilityLabel="Pergunta da enquete"
          style={styles.pollQuestion}
          multiline
          editable={!publishing}
        />
        <View style={styles.dashedRule} />
        <AppText variant="label" color={Colors.muted}>Opções</AppText>
        {poll.options.map((option, index) => (
          <View key={option.key} style={styles.pollOptionRow}>
            <View style={styles.pollLetter}><AppText style={styles.pollLetterText} color={Colors.paper}>{String.fromCharCode(65 + index)}</AppText></View>
            <TextInput
              value={option.label}
              onChangeText={(label) => onChange((current) => ({ ...current, options: current.options.map((item) => item.key === option.key ? { ...item, label } : item) }))}
              maxLength={POLL_OPTION_MAX}
              placeholder={`Opção ${String.fromCharCode(65 + index)}`}
              placeholderTextColor={Colors.placeholder}
              accessibilityLabel={`Opção ${String.fromCharCode(65 + index)}`}
              style={styles.pollOptionInput}
              editable={!publishing}
            />
            {poll.options.length > 2 ? <Pressable accessibilityRole="button" accessibilityLabel={`Remover opção ${String.fromCharCode(65 + index)}`} onPress={() => onChange((current) => ({ ...current, options: current.options.filter((item) => item.key !== option.key) }))} style={styles.pollRemove}><Icon name="close" size={18} /></Pressable> : null}
          </View>
        ))}
        {poll.options.length < POLL_MAX_OPTIONS ? <Pressable accessibilityRole="button" accessibilityLabel="Adicionar opção" onPress={() => { optionSeq.current += 1; const key = `option-${optionSeq.current}`; onChange((current) => current.options.length < POLL_MAX_OPTIONS ? { ...current, options: [...current.options, { key, label: '' }] } : current); }} style={({ pressed }) => [styles.addOption, pressed && styles.pressed]}>
          <AppText style={styles.addOptionLabel}>+ Adicionar opção</AppText>
        </Pressable> : null}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  pollShadow: { borderRadius: 8, ...Shadows.offset, boxShadow: '3px 3px 0 #16120F' },
  pollCard: { borderWidth: 2, borderColor: Colors.ink, borderRadius: 8, backgroundColor: Colors.paper, overflow: 'hidden' },
  pollHeader: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, backgroundColor: Colors.ink },
  pollCount: { fontFamily: Fonts.mono, fontSize: 10.5, lineHeight: 19 },
  pollBody: { padding: Spacing.three, gap: Spacing.three },
  pollQuestion: { fontFamily: Fonts.anton, fontSize: 27, lineHeight: 35, letterSpacing: -0.2, textTransform: 'uppercase', color: Colors.ink, minHeight: 60, paddingTop: Spacing.one },
  dashedRule: { borderBottomWidth: 2, borderStyle: 'dashed', borderBottomColor: Colors.ink },
  pollOptionRow: { minHeight: 52, flexDirection: 'row', alignItems: 'stretch', borderWidth: 2, borderColor: Colors.ink, borderRadius: Radius.sm, backgroundColor: Colors.cream, overflow: 'hidden' },
  pollLetter: { width: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.red },
  pollLetterText: { fontFamily: Fonts.anton, fontSize: 22, lineHeight: 30 },
  pollOptionInput: { flex: 1, minWidth: 0, paddingHorizontal: Spacing.three, fontFamily: Fonts.regular, fontSize: 15.5, lineHeight: 21, color: Colors.ink },
  pollRemove: { width: 40, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 2, borderLeftColor: Colors.ink },
  addOption: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.ink, borderRadius: Radius.sm },
  addOptionLabel: { fontFamily: Fonts.extrabold, fontSize: 14, lineHeight: 22 },
  pressed: { opacity: 0.68 },
});
