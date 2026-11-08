import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Kicker } from '@/components/kicker';
import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';
import { PillButton } from '@/components/pill-button';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { SingleTopicField } from '@/features/onboarding/components/single-topic-field';
import { SquareEntry } from '@/features/squares/square-entry';
import { ApiError } from '@/lib/errors';
import type { TopicId } from '@/types/models';

import {
  archiveComuna,
  cancelTransfer,
  deleteComuna,
  updateComuna,
  type ComunaRuleInput,
} from '../api';
import { cleanRules, RulesEditor, rulesViolation } from '../components/rules-editor';
import { comunaErrorMessage, deletionNeedsArchive } from '../errors';
import { invalidateComunaReads, writeComuna } from '../queries';
import type { ManageTabProps } from './manage-comuna-types';

/** Aba Comuna: dados editáveis, transferência pendente e saída/arquivamento/exclusão. */
export function SettingsTab({ comuna, onChanged }: ManageTabProps) {
  const toast = useToast();
  const perms = comuna.viewerPermissions;
  const [description, setDescription] = useState(comuna.description);
  const [topic, setTopic] = useState<TopicId | null>(comuna.topics[0] ?? null);
  const [rules, setRules] = useState<ComunaRuleInput[]>(comuna.rules.map((r) => ({ title: r.title, body: r.description })));
  const [violations, setViolations] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = async (work: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await work();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      setViolations({});
      try {
        const updated = await updateComuna(comuna.id, { description: description.trim(), rules: cleanRules(rules), ...(topic ? { topic } : {}) });
        // A página da comuna (que continua montada abaixo desta) vê a edição na hora.
        writeComuna(updated);
        toast.show('Dados da comuna salvos.');
        onChanged();
      } catch (error) {
        if (error instanceof ApiError && error.status === 422) setViolations(error.violations);
        else toast.show(comunaErrorMessage(error));
      }
    });

  const archive = () =>
    Alert.alert(
      'Arquivar a comuna?',
      'A comuna e o histórico ficam preservados para leitura de quem participa (se for privada, continua fechada). Ninguém poderá publicar, comentar ou entrar. Ninguém é removido. Arquivar é definitivo pelo app e libera uma vaga no seu limite de comunas ativas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Arquivar',
          style: 'destructive',
          onPress: () =>
            run(async () => {
              try {
                const updated = await archiveComuna(comuna.id);
                writeComuna(updated);
                void invalidateComunaReads(comuna.id);
                toast.show(`c/${comuna.handle} foi arquivada.`);
                onChanged();
              } catch (error) {
                toast.show(comunaErrorMessage(error));
              }
            }),
        },
      ],
    );

  const offerArchive = (message: string) =>
    Alert.alert('Não é possível excluir', message, [
      { text: 'Agora não', style: 'cancel' },
      ...(perms?.canArchive ? [{ text: 'Arquivar', onPress: archive }] : []),
    ]);

  const remove = () => {
    // Dica imediata pela contagem; o servidor confere de novo, com a comuna travada.
    if (comuna.memberCount > 1) {
      return offerArchive(
        'Esta comuna tem outros membros, por isso só pode ser arquivada. Ninguém será removido para permitir a exclusão.',
      );
    }
    Alert.alert(
      'Excluir definitivamente?',
      `• c/${comuna.handle} será excluída para sempre, com as suas publicações nela.\n• O nome ficará livre e a vaga no limite de comunas ativas será liberada imediatamente, sem espera.\n• Registros de segurança e de auditoria são mantidos, como manda a política de retenção.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () =>
            run(async () => {
              try {
                await deleteComuna(comuna.id);
                toast.show(`c/${comuna.handle} foi excluída.`);
                router.dismissTo('/perfil');
              } catch (error) {
                if (deletionNeedsArchive(error)) offerArchive(comunaErrorMessage(error));
                else toast.show(comunaErrorMessage(error));
              }
            }),
        },
      ],
    );
  };

  const transfer = comuna.ownershipTransfer;

  return (
    <KeyboardAwareScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.settings}>
      <SquareEntry slug={comuna.id} />
      {transfer?.direction === 'outgoing' ? (
        <View style={styles.card}>
          <Kicker label="Transferência pendente" />
          <AppText>
            Você propôs passar a comuna para {transfer.to.name} (@{transfer.to.handle}). Até o aceite, nada muda.
          </AppText>
          <PillButton
            label="Cancelar proposta"
            variant="outline"
            disabled={busy}
            onPress={() =>
              run(async () => {
                try {
                  await cancelTransfer(comuna.id);
                  toast.show('Proposta cancelada.');
                  onChanged();
                } catch (error) {
                  toast.show(comunaErrorMessage(error));
                }
              })
            }
          />
        </View>
      ) : null}

      {perms?.canEditDetails ? (
        <View style={styles.section}>
          <Kicker label="Dados da comuna" />
          <SingleTopicField value={topic} onChange={setTopic} error={violations.topic} disabled={busy} />
          <AppText variant="caption">O nome ({comuna.name}) e o endereço c/{comuna.handle} não mudam.</AppText>
          <TextField
            label="Descrição"
            labelAside={`${description.length}/500`}
            placeholder="Ex.: O que a comuna debate e para quem ela serve"
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            multiline
            hint={violations.description}
            hintColor={Colors.red}
          />
          <RulesEditor rules={rules} onChange={setRules} error={rulesViolation(violations)} />
          <PillButton label={busy ? 'Salvando…' : 'Salvar'} onPress={save} disabled={busy} size="lg" display />
        </View>
      ) : null}

      <View style={styles.section}>
        <Kicker label="Sair, arquivar ou excluir" />
        <Explainer
          title="Sair"
          text="Quem é proprietário não sai da comuna. Para deixar de responder por ela, passe-a para outro membro (aba Membros)."
        />
        <Explainer
          title="Arquivar"
          text="Preserva a comuna e o histórico para leitura de quem participa. Ninguém publica, comenta ou entra mais. É definitivo pelo app."
        />
        <Explainer
          title="Excluir definitivamente"
          text="Só quando você é o único membro e não há publicações ou comentários de outras pessoas. Não pode ser desfeito."
        />
        {perms?.canArchive ? <PillButton label="Arquivar comuna" onPress={archive} disabled={busy} variant="dark" size="lg" display /> : null}
        {perms?.canDelete ? (
          <PillButton label="Excluir definitivamente" onPress={remove} disabled={busy} variant="outline" size="lg" display />
        ) : null}
        {comuna.status === 'archived' ? (
          <AppText variant="caption">Esta comuna está arquivada. A exclusão definitiva não está disponível pelo app.</AppText>
        ) : null}
      </View>
    </KeyboardAwareScrollView>
  );
}

function Explainer({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.explainer}>
      <Icon name="chevronRight" size={16} color={Colors.red} />
      <View style={styles.rowText}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption">{text}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  settings: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.five,
    paddingBottom: Spacing.eight,
    gap: Spacing.six,
  },
  section: {
    gap: Spacing.three,
  },
  card: {
    gap: Spacing.three,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    borderRadius: Radius.xl,
    backgroundColor: Colors.paper,
  },
  explainer: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
});
