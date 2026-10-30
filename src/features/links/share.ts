import { Platform, Share } from 'react-native';
import { canonicalUrl, type ShareDestination } from './destinations';
const titles = { post: 'Veja esta publicação no Popularia', profile: 'Veja este perfil no Popularia', comuna: 'Conheça esta comuna no Popularia', document: 'Veja este documento no Popularia', event: 'Veja esta atividade no Popularia' };
export async function shareDestination(target: ShareDestination) {
  const url = canonicalUrl(target);
  const title = titles[target.kind];
  return Share.share(Platform.OS === 'ios' ? { title, message: title, url } : { title, message: `${title}\n${url}` });
}
