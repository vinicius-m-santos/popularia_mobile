import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SelectField } from '@/components/select-field';
import { DEMO_MODE } from '@/constants/config';
import { Spacing } from '@/constants/theme';

import { getBrazilMunicipalities, getBrazilStates, type LocationState, type Municipality } from './api';

const BRAZIL_STATES: LocationState[] = [
  ['12', 'Acre', 'AC'], ['27', 'Alagoas', 'AL'], ['16', 'Amapá', 'AP'], ['13', 'Amazonas', 'AM'], ['29', 'Bahia', 'BA'], ['23', 'Ceará', 'CE'], ['53', 'Distrito Federal', 'DF'], ['32', 'Espírito Santo', 'ES'], ['52', 'Goiás', 'GO'], ['21', 'Maranhão', 'MA'], ['51', 'Mato Grosso', 'MT'], ['50', 'Mato Grosso do Sul', 'MS'], ['31', 'Minas Gerais', 'MG'], ['15', 'Pará', 'PA'], ['25', 'Paraíba', 'PB'], ['41', 'Paraná', 'PR'], ['26', 'Pernambuco', 'PE'], ['22', 'Piauí', 'PI'], ['33', 'Rio de Janeiro', 'RJ'], ['24', 'Rio Grande do Norte', 'RN'], ['43', 'Rio Grande do Sul', 'RS'], ['11', 'Rondônia', 'RO'], ['14', 'Roraima', 'RR'], ['42', 'Santa Catarina', 'SC'], ['35', 'São Paulo', 'SP'], ['28', 'Sergipe', 'SE'], ['17', 'Tocantins', 'TO'],
].map(([id, name, abbreviation]) => ({ id, name, abbreviation }));

type Props = { stateId: string; municipalityId: string; city: string; state: string; onChange: (patch: { stateIbgeCode: string; municipalityIbgeCode: string; city: string; state: string }) => void; appearance?: 'default' | 'editorial' };

export function BrazilLocationFields({ stateId, municipalityId, state, onChange, appearance = 'default' }: Props) {
  const [states, setStates] = useState<LocationState[]>(DEMO_MODE ? BRAZIL_STATES : []);
  const [municipalityResult, setMunicipalityResult] = useState<{ stateId: string; items: Municipality[]; error?: string }>({ stateId: '', items: [] });
  const [statesError, setStatesError] = useState('');

  useEffect(() => {
    if (DEMO_MODE) return;
    getBrazilStates().then(setStates, () => setStatesError('Não conseguimos carregar os estados.'));
  }, []);

  useEffect(() => {
    if (!stateId) return;
    let active = true;
    getBrazilMunicipalities(stateId).then(
      (items) => { if (active) setMunicipalityResult({ stateId, items }); },
      () => { if (active) setMunicipalityResult({ stateId, items: [], error: 'Não conseguimos carregar as cidades.' }); },
    );
    return () => { active = false; };
  }, [stateId]);

  const municipalities = municipalityResult.stateId === stateId ? municipalityResult.items : [];
  const citiesLoading = !!stateId && municipalityResult.stateId !== stateId;

  const chooseState = (id: string) => {
    const selected = states.find((item) => item.id === id);
    if (selected) onChange({ stateIbgeCode: selected.id, municipalityIbgeCode: '', city: '', state: selected.name });
  };
  const chooseCity = (id: string) => {
    const selected = municipalities.find((item) => item.id === id);
    if (selected) onChange({ stateIbgeCode: stateId, municipalityIbgeCode: selected.id, city: selected.name, state: states.find((item) => item.id === stateId)?.name ?? state });
  };

  return <View style={styles.group}>
    <SelectField appearance={appearance} label="Estado" value={stateId} placeholder="Selecione o estado" loading={!DEMO_MODE && states.length === 0 && !statesError} options={states.map((item) => ({ value: item.id, label: `${item.name} (${item.abbreviation})` }))} onChange={chooseState} error={!stateId ? statesError || undefined : undefined} />
    <SelectField appearance={appearance} label="Cidade" value={municipalityId} placeholder={stateId ? 'Selecione a cidade' : 'Escolha o estado primeiro'} disabled={!stateId} loading={citiesLoading} options={municipalities.map((item) => ({ value: item.id, label: item.name }))} onChange={chooseCity} error={municipalityResult.stateId === stateId ? municipalityResult.error : undefined} />
  </View>;
}

const styles = StyleSheet.create({ group: { gap: Spacing.three } });
