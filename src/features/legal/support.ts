import { Linking } from 'react-native';

export const SUPPORT_EMAIL = 'suporte@popularia.com.br';

/**
 * Abre o app de e-mail do aparelho com o assunto já preenchido.
 * Devolve `false` quando o sistema não consegue abrir um cliente de e-mail.
 */
export async function openSupportMail(subject: string): Promise<boolean> {
  try {
    await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`);
    return true;
  } catch {
    return false;
  }
}
