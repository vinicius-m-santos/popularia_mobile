import { Linking, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { PillButton } from '@/components/pill-button';
import { useToast } from '@/components/toast';
import { API_BASE_URL } from '@/constants/config';

export const LEGAL_BASE_URL = API_BASE_URL ? API_BASE_URL.replace(/\/api\/v1$/, '') : 'https://api.popularia.com.br';
export function LegalLinks() {
  const toast = useToast();
  return <View style={{ gap: 8 }}>
    <AppText variant="heading">Sobre e legal</AppText>
    {[
      ['Política de Privacidade', 'privacidade'], ['Termos de Uso', 'termos'],
      ['Regras da Comunidade', 'regras'], ['Suporte e contato', 'suporte'],
    ].map(([label, path]) => <PillButton key={path} label={label} variant="outline" onPress={() => {
      Linking.openURL(`${LEGAL_BASE_URL}/${path}`).catch(() => toast.show('Não foi possível abrir o documento. Tente novamente.'));
    }} />)}
    <AppText variant="caption">Contato: vinicius.m.dos.s@gmail.com</AppText>
  </View>;
}
