import type { ReactNode } from 'react';
import { dataSource } from './geniusConfig';

// Wybiera wersję elementu: na domenie ligi dane Genius Sports, poza nią nasze dane testowe.
function BySource({ genius, mock }: { genius: ReactNode; mock: ReactNode }) {
  return <>{dataSource === 'genius' ? genius : mock}</>;
}

export default BySource;
