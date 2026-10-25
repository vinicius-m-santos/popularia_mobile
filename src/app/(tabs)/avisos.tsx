import { ComingSoon } from '@/components/coming-soon';
import { Screen } from '@/components/screen';

export default function NotificationsScreen() {
  return (
    <Screen title="Avisos">
      <ComingSoon designRef="2g" />
    </Screen>
  );
}
