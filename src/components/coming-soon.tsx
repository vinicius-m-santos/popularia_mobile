import { StateView } from '@/components/state-view';

type ComingSoonProps = {
  /** Etapa do design em que a tela será implementada, por exemplo "2e". */
  designRef: string;
};

/** Marcador de telas ainda não implementadas nesta etapa. */
export function ComingSoon({ designRef }: ComingSoonProps) {
  return (
    <StateView
      kind="empty"
      title="Em construção"
      message={`Esta tela será implementada a partir do design ${designRef}.`}
    />
  );
}
