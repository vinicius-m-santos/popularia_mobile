import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { KeyboardView } from '@/components/keyboard-view';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { UnderlineTabs, type TabOption } from '@/components/underline-tabs';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { goBack } from '@/lib/routes';

import { comunaErrorMessage } from './errors';
import { useComuna } from './queries';
import { MembersTab, RequestsTab } from './components/manage-comuna-people-tabs';
import { SettingsTab } from './components/manage-comuna-settings-tab';

type ManageTab = 'membros' | 'pedidos' | 'comuna';

/**
 * Gestão da comuna (só com a API), para quem é proprietário ou modera. Cada aba e cada botão
 * aparecem conforme as permissões que o servidor mandou com a comuna; toda ação é conferida de
 * novo na API, e uma recusa aparece como mensagem, sem mudar nada na tela.
 */
export default function ManageComunaScreen() {
  const { id, aba } = useLocalSearchParams<{ id: string; aba?: string }>();
  // Mesma chave da página da comuna: abrir a gestão não repete o detalhe.
  const comuna = useComuna(id);
  const [tab, setTab] = useState<ManageTab>(aba === 'pedidos' ? 'pedidos' : 'membros');

  const header = (subtitle?: string) => (
    <View style={styles.bar}>
      <IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} />
      <View style={styles.barText}>
        <AppText style={styles.barTitle} accessibilityRole="header" numberOfLines={1}>
          Gerir comuna
        </AppText>
        {subtitle ? (
          <AppText variant="caption" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );

  if (DEMO_MODE) {
    return (
      <Screen>
        {header()}
        <StateView kind="empty" title="Disponível com o servidor" message="No modo demonstração, a gestão de comunas não é simulada." />
      </Screen>
    );
  }

  if (!comuna.data) {
    return (
      <Screen>
        {header()}
        {comuna.status === 'error' ? (
          <StateView kind="error" message={`Não conseguimos carregar a comuna. ${comunaErrorMessage(comuna.error)}`} onRetry={comuna.reload} />
        ) : (
          <StateView kind="loading" message="Carregando comuna" />
        )}
      </Screen>
    );
  }

  const data = comuna.data;
  const perms = data.viewerPermissions;
  const isOwner = data.viewerRole === 'founder';
  const isModerator = data.viewerRole === 'moderator';
  if (!perms || (!isOwner && !isModerator)) {
    return (
      <Screen>
        {header(`c/${data.handle}`)}
        <StateView kind="empty" title="Você não gere esta comuna" message="Só quem é proprietário ou modera a comuna vê esta tela." />
      </Screen>
    );
  }

  const tabs: TabOption<ManageTab>[] = [
    { key: 'membros', label: 'Membros' },
    ...(perms.canReviewJoinRequests ? [{ key: 'pedidos' as const, label: 'Pedidos' }] : []),
    ...(isOwner ? [{ key: 'comuna' as const, label: 'Comuna' }] : []),
  ];
  const current = tabs.some((t) => t.key === tab) ? tab : 'membros';

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardView style={{ flex: 1 }}>
        {header(`c/${data.handle} · você é ${isOwner ? 'proprietário' : 'moderação'}`)}
        {comuna.status === 'error' ? (
          <StateView kind="error" message="Não conseguimos atualizar a comuna." onRetry={comuna.reload} />
        ) : null}
        {data.status === 'archived' ? (
          <View style={styles.archived}>
            <AppText style={styles.archivedText} color={Colors.cream}>
              Comuna arquivada: só leitura. Você ainda pode remover pessoas e tirar alguém da moderação.
            </AppText>
          </View>
        ) : null}
        <UnderlineTabs options={tabs} value={current} onChange={setTab} height={46} />
        {current === 'membros' ? <MembersTab comuna={data} onChanged={comuna.reload} /> : null}
        {current === 'pedidos' ? <RequestsTab comuna={data} onChanged={comuna.reload} /> : null}
        {current === 'comuna' ? (
          // A chave muda quando descrição ou regras mudam no servidor: o formulário recomeça com elas.
          <SettingsTab key={JSON.stringify([data.description, data.rules, data.topics])} comuna={data} onChanged={comuna.reload} />
        ) : null}
      </KeyboardView>
    </Screen>
  );
}

const styles = StyleSheet.create({bar: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.ink,
  },
barText: {
    flex: 1,
  },
barTitle: {
    fontFamily: Fonts.condensed,
    fontSize: 21,
    lineHeight: 24,
    textTransform: 'uppercase',
  },
archived: {
    backgroundColor: Colors.ink,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.two + 2,
  },
archivedText: {
    fontSize: 13.5,
    lineHeight: 18,
  },
});
