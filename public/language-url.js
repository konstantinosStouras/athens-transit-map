// The URL determines the page language. Greek is the default, with no language query.
export const languageFromSearch = search => new URLSearchParams(search).get('lang') === 'en' ? 'en' : 'el';
export const languageQuery = language => language === 'en' ? '?lang=en' : '';
export function withLanguage(url, language) {
  const next = new URL(url);
  if (language === 'el') next.searchParams.delete('lang');
  else next.searchParams.set('lang', language);
  return next;
}
