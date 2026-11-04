import { ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { LEGAL_VERSION } from '@/features/account/api';
import { EventBar } from '@/features/events/chrome';
import { formatBrazilDate } from '@/lib/format';

const docs: Record<string, { title: string; text: string }> = {
  regras: { title: 'Regras da Comunidade', text: 'Debata ideias sem atacar pessoas. Não aceitamos racismo, discriminação, desumanização, propaganda nazista, ameaças, assédio, perseguição ou incentivo à violência.\n\nProteja dados pessoais, respeite autoria, licenças e o acesso de Comunas e documentos. Não envie spam, fraude, conteúdo ilegal ou arquivos maliciosos.\n\nUse as ferramentas de denúncia e bloqueio de boa-fé. Cada Comuna pode ter regras adicionais compatíveis com estas.' },
  termos: { title: 'Termos de Uso', text: 'O Popularia reúne pessoas em perfis, Comunas, Praças e Bibliotecas. O beta é destinado a maiores de 18 anos. Proteja suas credenciais e use apenas identidades que você controla.\n\nVocê continua titular dos direitos do seu conteúdo, concedendo ao Popularia autorização limitada para operar o serviço e mostrar o conteúdo às pessoas autorizadas.\n\nPodemos remover conteúdo ou restringir contas para proteger a comunidade. Você pode excluir sua conta pelo aplicativo; a Política de Privacidade explica o tratamento dos dados.' },
  privacidade: { title: 'Política de Privacidade', text: 'Tratamos e-mail, identificador, nome, @, bio, endereço declarado, interesses e preferências para criar a conta, organizar o perfil, recomendar conteúdo e controlar acessos. A senha é armazenada como hash. Não usamos GPS para obter sua cidade.\n\nSeu e-mail, senha, interesses, sessões e bloqueios não fazem parte do perfil público. Conteúdos em Comunas e Praças seguem as permissões de cada espaço.\n\nVocê pode pedir acesso, correção, informação, eliminação ou revisão pelo suporte. Para excluir a conta, use Conta → Excluir conta. Não envie senha ou token ao suporte.' },
};

/** Documento legal aberto pelos cards de "Sobre e legal". */
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
          <AppText variant="caption">Documentos vigentes da Popularia, versão {formatBrazilDate(LEGAL_VERSION)}.</AppText>
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
  body: {
    fontSize: 16,
    lineHeight: 26,
  },
});
