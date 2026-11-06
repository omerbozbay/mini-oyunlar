export function turkishWord(value: string) {
  return value.trim().normalize("NFC").toLocaleUpperCase("tr-TR");
}
export function validWord(value: string, min: number, max: number) {
  const word = turkishWord(value);
  return (
    word.length >= min &&
    word.length <= max &&
    /^[ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ]+$/u.test(word)
  );
}
export function validNumber(value: string) {
  return (
    /^[1-9][0-9]{3}$/.test(value.trim()) && new Set(value.trim()).size === 4
  );
}
