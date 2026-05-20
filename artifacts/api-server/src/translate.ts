import { logger } from "./lib/logger";

const LANG_MAP: Record<string, string> = {
  es: "es-ES",
  de: "de-DE",
  fr: "fr-FR",
  pt: "pt-BR",
  it: "it-IT",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "zh-CN",
  hi: "hi-IN",
  id: "id-ID",
  bn: "bn-BD",
  tr: "tr-TR",
};

export function isTranslatableLanguage(lang: string): boolean {
  return lang in LANG_MAP;
}

/**
 * Translate an array of text segments in one MyMemory API call.
 * Segments are joined with " ||| " and split on the same delimiter in the response.
 */
export async function batchTranslateSegments(texts: string[], targetLang: string): Promise<string[]> {
  if (texts.length === 0) return [];
  const mymemoryLang = LANG_MAP[targetLang];
  if (!mymemoryLang) return texts;

  const joined = texts.join(" ||| ");
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(joined)}&langpair=en|${mymemoryLang}&de=contact@hunch.app`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);

  const data = await res.json() as { responseData: { translatedText: string }; responseStatus: number };
  if (data.responseStatus !== 200) {
    throw new Error(`MyMemory responseStatus ${data.responseStatus}`);
  }

  const parts = data.responseData.translatedText.split(" ||| ");

  if (parts.length !== texts.length) {
    logger.warn({ expected: texts.length, got: parts.length }, "MyMemory split count mismatch — padding with originals");
    while (parts.length < texts.length) parts.push(texts[parts.length]);
  }

  return parts;
}

export interface OptionStub { id: number; label: string }

export interface HunchTranslation {
  title: string;
  description: string;
  optionTranslations: Record<number, string>;
}

/**
 * Translate title + description + option labels for a single hunch.
 * Falls back to original values if translation fails.
 */
export async function translateOneHunch(
  hunchId: number,
  title: string,
  description: string,
  options: OptionStub[],
  lang: string,
): Promise<HunchTranslation> {
  const optionLabels = options.map((o) => o.label);
  const segments = [title, description, ...optionLabels];

  try {
    const translated = await batchTranslateSegments(segments, lang);
    const optionTranslations: Record<number, string> = {};
    options.forEach((o, i) => { optionTranslations[o.id] = translated[2 + i] ?? o.label; });
    return { title: translated[0] ?? title, description: translated[1] ?? description, optionTranslations };
  } catch (err) {
    logger.warn({ err, hunchId, lang }, "Translation failed — falling back to English");
    const optionTranslations: Record<number, string> = {};
    options.forEach((o) => { optionTranslations[o.id] = o.label; });
    return { title, description, optionTranslations };
  }
}
