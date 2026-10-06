// Litery do filtra "pierwsza litera nazwiska" (alfabet polski z literami spotykanymi w nazwiskach obcych).
export const surnameLetters = ['A', 'B', 'C', 'Ć', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'Ł', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'Ś', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Ź', 'Ż'];

// Opcje listy rozwijanej: najpierw brak litery (wszyscy), potem litery.
export const letterOptions = [{ value: '', label: 'Wszystkie litery' }, ...surnameLetters.map((letter) => ({ value: letter, label: letter }))];

// Domyślnie bez filtra litery — lista pokazuje wszystkich zawodników.
export const DEFAULT_LETTER = '';
