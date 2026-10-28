import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { PrivacyPanel } from '@/features/profiles/privacy-panel';
import { BlockedPeoplePanel } from '@/features/profiles/blocked-people-panel';
import { DeletionPanel } from './deletion-panel';
import { ContactScreen } from './contact-screen';
import { LegalDocumentScreen } from '@/features/legal/legal-document-screen';
import { ProfileEditorScreen } from './profile-editor-screen';

const titles: Record<string, string> = { 'meus-dados': 'Meus dados', privacidade: 'Privacidade', bloqueados: 'Pessoas bloqueadas', 'sobre-e-legal': 'Sobre e legal', exclusao: 'Exclusão de conta', contato: 'Suporte e contato' };
export default function AccountSectionScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  if (section === 'sobre-e-legal') return <LegalDocumentScreen showSupport />;
  if (section === 'meus-dados') return <ProfileEditorScreen />;
  if (section === 'contato') return <ContactScreen />;
  return <Screen><View style={styles.bar}><IconButton icon="back" accessibilityLabel="Voltar" onPress={() => router.back()} /><AppText style={styles.title}>{titles[section ?? ''] ?? 'Conta'}</AppText></View><ScrollView contentContainerStyle={styles.content}>{section === 'privacidade' ? <PrivacyPanel /> : section === 'bloqueados' ? <BlockedPeoplePanel /> : <DeletionPanel />}</ScrollView></Screen>;
}
const styles = StyleSheet.create({ bar: { height: 56, flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingHorizontal: Spacing.two, borderBottomWidth: 1.5, borderBottomColor: Colors.ink }, title: { fontFamily: Fonts.condensed, fontSize: 21, textTransform: 'uppercase' }, content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.five, gap: Spacing.five } });
