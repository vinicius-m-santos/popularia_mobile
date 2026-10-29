import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { EditorialAction } from '@/components/editorial-action';
import { goBack } from '@/lib/routes';
export default function UnavailableLink() {
  return <Screen><StateView kind="empty" title="Link indisponível" message="Este link não é válido para esta versão ou ambiente do Popularia." /><EditorialAction icon="back" label="Voltar" onPress={goBack} /></Screen>;
}
