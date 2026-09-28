// Lista najlepszych wynikow. Glownie trzymana na serwerze (serve.py -> plik highscores.json),
// a gdy serwer jej nie obsluguje (np. zwykly "python -m http.server") - w localStorage przegladarki.

const API_URL = "api/highscores";
const STORAGE_KEY = "pengo.highscores";
const LAST_NAME_KEY = "pengo.lastName";
export const MAX_ENTRIES = 10;
export const MAX_NAME_LENGTH = 10;

function loadLocal() {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(list) ? list.slice(0, MAX_ENTRIES) : [];
  } catch {
    return []; // np. zablokowana pamiec strony - gra dziala dalej, tylko bez zapisu
  }
}

function addLocal(entry) {
  const list = loadLocal();
  // przy rownym wyniku nowy wpis laduje ponizej starszych
  let index = list.findIndex((e) => entry.score > e.score);
  if (index === -1) index = list.length;
  list.splice(index, 0, entry);
  list.length = Math.min(list.length, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // brak zapisu - lista i tak pokaze sie do konca tej sesji
  }
  return { list, index: index < MAX_ENTRIES ? index : -1 };
}

/** Zwraca liste { name, score, level } posortowana od najlepszego wyniku. */
export async function loadScores() {
  try {
    const res = await fetch(API_URL);
    if (res.ok) return await res.json();
  } catch {
    // serwer niedostepny - nizej lista z przegladarki
  }
  return loadLocal();
}

/** Czy ten wynik miesci sie na liscie? */
export function qualifies(score, list) {
  if (score <= 0) return false;
  return list.length < MAX_ENTRIES || score > list[list.length - 1].score;
}

/** Dopisuje wynik i zwraca { list, index } - index to pozycja nowego wpisu (do wyroznienia). */
export async function addScore(name, score, level) {
  rememberName(name);
  const entry = { name, score, level };
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (res.ok) return await res.json();
  } catch {
    // serwer niedostepny - zapis w przegladarce
  }
  return addLocal(entry);
}

function rememberName(name) {
  try {
    localStorage.setItem(LAST_NAME_KEY, name);
  } catch {
    // bez podpowiedzi imienia nastepnym razem
  }
}

/** Ostatnio wpisane imie w tej przegladarce - podpowiadane przy kolejnym rekordzie. */
export function lastName() {
  try {
    return localStorage.getItem(LAST_NAME_KEY) || "";
  } catch {
    return "";
  }
}
