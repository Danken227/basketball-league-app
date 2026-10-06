import { useSyncExternalStore } from 'react';
import { indexVersion, subscribeIndex } from '../components/genius/geniusIndex';

// Odświeża komponent przy każdej zmianie indeksu rozgrywek (nowa lista, nowy wynik sprawdzenia występów).
export const useGeniusIndex = () => useSyncExternalStore(subscribeIndex, indexVersion);
