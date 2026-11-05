import { Profiler, useId, type ComponentType, type ReactNode } from 'react';

import { performanceInstrumentationEnabled, recordProfileCommit } from './index';

function ProfileBoundary({ component, children }: { component: string; children: ReactNode }) {
  // ID estável por instância montada: a reciclagem da FlashList reutiliza a
  // instância e os commits continuam atribuídos ao mesmo cartão.
  const instanceId = useId();
  return (
    <Profiler
      id={component}
      onRender={(_id, phase, actualDuration, baseDuration) => {
        recordProfileCommit({
          component,
          instanceId,
          phase,
          actualDurationMs: actualDuration,
          baseDurationMs: baseDuration,
        });
      }}>
      {children}
    </Profiler>
  );
}

/**
 * Envolve um componente com React Profiler quando a instrumentação está ligada.
 * Desligada (produção ou default), devolve o componente sem nenhum wrapper,
 * sem listener e sem overhead de render adicional.
 */
export function withPerformanceProfiler<P extends object>(
  component: string,
  Inner: ComponentType<P>,
): ComponentType<P> {
  function Profiled(props: P) {
    if (!performanceInstrumentationEnabled()) return <Inner {...props} />;
    return (
      <ProfileBoundary component={component}>
        <Inner {...props} />
      </ProfileBoundary>
    );
  }
  Profiled.displayName = `Perf(${component})`;
  return Profiled;
}
