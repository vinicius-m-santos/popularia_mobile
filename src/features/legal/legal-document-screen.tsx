import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { EventBar } from '@/features/events/chrome';
import { LEGAL_VERSION } from '@/features/account/api';
import { formatBrazilDate } from '@/lib/format';

const docs: Record<string, { title: string; text: string }> = {
  regras: { title: 'Regras da Comunidade', text: 'Debata ideias sem atacar pessoas. Não aceitamos racismo, discriminação, desumanização, propaganda nazista, ameaças, assédio, perseguição ou incentivo à violência.\n\nProteja dados pessoais, respeite autoria, licenças e o acesso de Comunas e documentos. Não envie spam, fraude, conteúdo ilegal ou arquivos maliciosos.\n\nUse as ferramentas de denúncia e bloqueio de boa-fé. Cada Comuna pode ter regras adicionais compatíveis com estas.' },
  termos: { title: 'Termos de Uso', text: 'O Popularia reúne pessoas em perfis, Comunas, Praças e Bibliotecas. O beta é destinado a maiores de 18 anos. Proteja suas credenciais e use apenas identidades que você controla.\n\nVocê continua titular dos direitos do seu conteúdo, concedendo ao Popularia autorização limitada para operar o serviço e mostrar o conteúdo às pessoas autorizadas.\n\nPodemos remover conteúdo ou restringir contas para proteger a comunidade. Você pode excluir sua conta pelo aplicativo; a Política de Privacidade explica o tratamento dos dados.' },
  privacidade: { title: 'Política de Privacidade', text: 'Tratamos e-mail, identificador, nome, @, bio, endereço declarado, interesses e preferências para criar a conta, organizar o perfil, recomendar conteúdo e controlar acessos. A senha é armazenada como hash. Não usamos GPS para obter sua cidade.\n\nSeu e-mail, senha, interesses, sessões e bloqueios não fazem parte do perfil público. Conteúdos em Comunas e Praças seguem as permissões de cada espaço.\n\nVocê pode pedir acesso, correção, informação, eliminação ou revisão pelo suporte. Para excluir a conta, use Conta → Excluir conta. Não envie senha ou token ao suporte.' },
};

const META: Record<string, { icon: IconName; subtitle: string; accent: 'red' | 'ink' }> = {
  regras: { icon: 'shield', subtitle: 'Convivência, denúncias e moderação', accent: 'red' },
  termos: { icon: 'document', subtitle: 'Uso do aplicativo e do seu conteúdo', accent: 'ink' },
  privacidade: { icon: 'user', subtitle: 'Dados, sessões e visibilidade', accent: 'ink' },
};

export function LegalDocumentScreen({ showSupport = false }: { showSupport?: boolean }) {
  return <Screen>
    <EventBar title="Sobre e legal" />
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      contentContainerStyle={styles.content}>
      <AppText variant="caption">Documentos vigentes da Popularia, versão {formatBrazilDate(LEGAL_VERSION)}.</AppText>
      <SectionHeading appearance="editorial" label="Documentos" />
      <View style={styles.actions}>
        {Object.entries(docs).map(([id, value]) => (
          <LegalAction
            key={id}
            icon={META[id].icon}
            accent={META[id].accent}
            title={value.title}
            subtitle={META[id].subtitle}
            onPress={() => router.push({ pathname: '/documento-legal/[id]', params: { id } } as never)}
          />
        ))}
        {showSupport ? (
          <LegalAction
            icon="comment"
            accent="ink"
            title="Suporte e contato"
            subtitle="Fale com a equipe da Popularia"
            onPress={() => router.push('/conta/contato' as never)}
          />
        ) : null}
      </View>
    </ScrollView>
  </Screen>;
}

function LegalAction({ icon, accent, title, subtitle, onPress }: {
  icon: IconName;
  accent: 'red' | 'ink';
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const red = accent === 'red';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <View style={[styles.iconBox, red ? styles.iconBoxRed : styles.iconBoxInk]}>
        <Icon name={icon} size={20} color={red ? Colors.red : Colors.ink} />
      </View>
      <View style={styles.actionCopy}>
        <AppText style={styles.actionTitle}>{title}</AppText>
        <AppText variant="caption">{subtitle}</AppText>
      </View>
      <Icon name="chevronRight" size={18} color={Colors.muted} />
    </Pressable>
  );
}

export function LegalDocumentPage({ id }: { id: string }) {
  const selected = docs[id];
  return <Screen>
    <EventBar title={selected?.title ?? 'Documento'} />
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      contentContainerStyle={styles.content}>
      {selected ? (
        <>
          <AppText variant="heading">{selected.title}</AppText>
          <AppText style={styles.body}>{selected.text}</AppText>
        </>
      ) : (
        <AppText>Documento não encontrado.</AppText>
      )}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.five,
    paddingBottom: Spacing.seven,
    gap: Spacing.three,
  },
  actions: {
    gap: Spacing.two,
  },
  action: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  pressed: {
    backgroundColor: Colors.strawLight,
  },
  iconBox: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxRed: {
    backgroundColor: Colors.redSoft,
  },
  iconBoxInk: {
    backgroundColor: Colors.strawLight,
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  actionTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    fontSize: 16,
    lineHeight: 26,
  },
});

export default LegalDocumentScreen;
