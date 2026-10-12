// Wpis z formularza panelu przekazywany do okna podglądu (NewsPreviewPage) przez localStorage — to samo źródło
// strony, a zdarzenie "storage" odświeża otwarte już okno podglądu.
import client from '@client/client';

export const NEWS_DRAFT_KEY = `${client.storagePrefix}-news-preview`;

export interface NewsDraft {
  title: string;
  body: string;
  category: string;
  image: string;
  // Chwila kliknięcia „Podgląd” — ten sam wpis zapisany ponownie też odświeża okno podglądu.
  previewAt: number;
}

export function saveNewsDraft(draft: NewsDraft) {
  try {
    localStorage.setItem(NEWS_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function readNewsDraft(): NewsDraft | undefined {
  try {
    const draft = JSON.parse(localStorage.getItem(NEWS_DRAFT_KEY) ?? 'null') as NewsDraft | null;
    return draft ?? undefined;
  } catch {
    return undefined;
  }
}
