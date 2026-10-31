import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
import { Colors, Spacing } from '@/constants/theme';

type HelpSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/** Explicação curta do que conta (e do que não conta) para XP, sequência e conquistas. */
export function ProgressHelpSheet({ visible, onClose }: HelpSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Como funciona">
      <View style={styles.blocks}>
        <Block title="XP">
          Participar de enquetes e discussões, salvar publicações, entrar em comunas e confirmar presença em eventos rende XP. Publicar e seguir não rendem.
        </Block>
        <Block title="Missões">
          Cada missão concluída soma XP, e fechar as três do dia soma um bônus. Novas missões chegam à meia-noite.
        </Block>
        <Block title="Sequência">
          Um dia conta quando você participa de verdade; abrir o app não conta. O dia vira à meia-noite, horário de Brasília.
        </Block>
        <Block title="Conquistas">
          Desbloqueiam uma vez por conta. Não há ranking.
        </Block>
      </View>
    </BottomSheet>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.block}>
      <AppText variant="label">{title}</AppText>
      <AppText variant="body" style={styles.body}>{children}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  blocks: { gap: Spacing.four },
  block: { gap: Spacing.one + 2 },
  body: { color: Colors.inkSoft },
});
