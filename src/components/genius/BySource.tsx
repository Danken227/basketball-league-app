import type { ReactNode } from 'react';
import { dataSource } from './geniusConfig';

// Wybiera wersję elementu: dane Genius Sports (na żywo albo z migawki) albo nasze dane testowe.
function BySource({ genius, mock }: { genius: ReactNode; mock: ReactNode }) {
  return <>{dataSource === 'mock' ? mock : genius}</>;
}

export default BySource;
