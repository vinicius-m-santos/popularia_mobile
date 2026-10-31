import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { Screen } from '@/components/screen';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { EventBar } from '@/features/events/chrome';
import { LegalDocumentScreen } from '@/features/legal/legal-document-screen';
import { BlockedPeoplePanel } from '@/features/profiles/blocked-people-panel';
import { PrivacyPanel } from '@/features/profiles/privacy-panel';

import { ContactScreen } from './contact-screen';
import { DeletionPanel } from './deletion-panel';
import { ProfileEditorScreen } from './profile-editor-screen';

const TITLES: Record<string, string> = {
  'meus-dados': 'Meus dados',
  privacidade: 'Privacidade',
  bloqueados: 'Pessoas bloqueadas',
  'sobre-e-legal': 'Sobre e legal',
  exclusao: 'Exclusão de conta',
  contato: 'Suporte e contato',
};

export default function AccountSectionScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  if (section === 'sobre-e-legal') return <LegalDocumentScreen showSupport />;
  if (section === 'meus-dados') return <ProfileEditorScreen />;
  if (section === 'contato') return <ContactScreen />;

  return (
    <Screen>
      <EventBar title={TITLES[section ?? ''] ?? 'Conta'} />
      <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} contentContainerStyle={styles.content}>
        {section === 'privacidade' ? <PrivacyPanel /> : section === 'bloqueados' ? <BlockedPeoplePanel /> : <DeletionPanel />}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.five,
    paddingBottom: Spacing.seven,
    gap: Spacing.five,
  },
});
