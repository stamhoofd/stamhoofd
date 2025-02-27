const locales = new Set([
    "Cy-az-AZ",
    "Cy-sr-SP",
    "Cy-uz-UZ",
    "Lt-az-AZ",
    "Lt-sr-SP",
    "Lt-uz-UZ",
    "aa",
    "ab",
    "ae",
    "af",
    "af-ZA",
    "ak",
    "am",
    "an",
    "ar",
    "ar-AE",
    "ar-BH",
    "ar-DZ",
    "ar-EG",
    "ar-IQ",
    "ar-JO",
    "ar-KW",
    "ar-LB",
    "ar-LY",
    "ar-MA",
    "ar-OM",
    "ar-QA",
    "ar-SA",
    "ar-SY",
    "ar-TN",
    "ar-YE",
    "as",
    "av",
    "ay",
    "az",
    "ba",
    "be",
    "be-BY",
    "bg",
    "bg-BG",
    "bh",
    "bi",
    "bm",
    "bn",
    "bo",
    "br",
    "bs",
    "ca",
    "ca-ES",
    "ce",
    "ch",
    "co",
    "cr",
    "cs",
    "cs-CZ",
    "cu",
    "cv",
    "cy",
    "da",
    "da-DK",
    "de",
    "de-AT",
    "de-CH",
    "de-DE",
    "de-LI",
    "de-LU",
    "div-MV",
    "dv",
    "dz",
    "ee",
    "el",
    "el-GR",
    "en",
    "en-AU",
    "en-BZ",
    "en-CA",
    "en-CB",
    "en-GB",
    "en-IE",
    "en-JM",
    "en-NZ",
    "en-PH",
    "en-TT",
    "en-US",
    "en-ZA",
    "en-ZW",
    "eo",
    "es",
    "es-AR",
    "es-BO",
    "es-CL",
    "es-CO",
    "es-CR",
    "es-DO",
    "es-EC",
    "es-ES",
    "es-GT",
    "es-HN",
    "es-MX",
    "es-NI",
    "es-PA",
    "es-PE",
    "es-PR",
    "es-PY",
    "es-SV",
    "es-UY",
    "es-VE",
    "et",
    "et-EE",
    "eu",
    "eu-ES",
    "fa",
    "fa-IR",
    "ff",
    "fi",
    "fi-FI",
    "fj",
    "fo",
    "fo-FO",
    "fr",
    "fr-BE",
    "fr-CA",
    "fr-CH",
    "fr-FR",
    "fr-LU",
    "fr-MC",
    "fy",
    "ga",
    "gd",
    "gl",
    "gl-ES",
    "gn",
    "gu",
    "gu-IN",
    "gv",
    "ha",
    "he",
    "he-IL",
    "hi",
    "hi-IN",
    "ho",
    "hr",
    "hr-HR",
    "ht",
    "hu",
    "hu-HU",
    "hy",
    "hy-AM",
    "hz",
    "ia",
    "id",
    "id-ID",
    "ie",
    "ig",
    "ii",
    "ik",
    "io",
    "is",
    "is-IS",
    "it",
    "it-CH",
    "it-IT",
    "iu",
    "ja",
    "ja-JP",
    "jv",
    "ka",
    "ka-GE",
    "kg",
    "ki",
    "kj",
    "kk",
    "kk-KZ",
    "kl",
    "km",
    "kn",
    "kn-IN",
    "ko",
    "ko-KR",
    "kr",
    "ks",
    "ku",
    "kv",
    "kw",
    "ky",
    "ky-KZ",
    "la",
    "lb",
    "lg",
    "li",
    "ln",
    "lo",
    "lt",
    "lt-LT",
    "lu",
    "lv",
    "lv-LV",
    "mg",
    "mh",
    "mi",
    "mk",
    "mk-MK",
    "ml",
    "mn",
    "mn-MN",
    "mr",
    "mr-IN",
    "ms",
    "ms-BN",
    "ms-MY",
    "mt",
    "my",
    "na",
    "nb",
    "nb-NO",
    "nd",
    "ne",
    "ng",
    "nl",
    "nl-BE",
    "nl-NL",
    "nn",
    "nn-NO",
    "no",
    "nr",
    "nv",
    "ny",
    "oc",
    "oj",
    "om",
    "or",
    "os",
    "pa",
    "pa-IN",
    "pi",
    "pl",
    "pl-PL",
    "ps",
    "pt",
    "pt-BR",
    "pt-PT",
    "qu",
    "rm",
    "rn",
    "ro",
    "ro-RO",
    "ru",
    "ru-RU",
    "rw",
    "sa",
    "sa-IN",
    "sc",
    "sd",
    "se",
    "sg",
    "si",
    "sk",
    "sk-SK",
    "sl",
    "sl-SI",
    "sm",
    "sn",
    "so",
    "sq",
    "sq-AL",
    "sr",
    "ss",
    "st",
    "su",
    "sv",
    "sv-FI",
    "sv-SE",
    "sw",
    "sw-KE",
    "ta",
    "ta-IN",
    "te",
    "te-IN",
    "tg",
    "th",
    "th-TH",
    "ti",
    "tk",
    "tl",
    "tn",
    "to",
    "tr",
    "tr-TR",
    "ts",
    "tt",
    "tt-RU",
    "tw",
    "ty",
    "ug",
    "uk",
    "uk-UA",
    "ur",
    "ur-PK",
    "uz",
    "ve",
    "vi",
    "vi-VN",
    "vo",
    "wa",
    "wo",
    "xh",
    "yi",
    "yo",
    "za",
    "zh",
    "zh-CHS",
    "zh-CHT",
    "zh-CN",
    "zh-HK",
    "zh-MO",
    "zh-SG",
    "zh-TW",
    "zu"
  ]);


export function isValidLocale(locale: string): boolean {
    return locales.has(locale);
}

export function isLanguage(value:string): boolean {
    if(value.includes("-")) {
        return false;
    }

    return locales.has(value);
}

export function isLocale(value:string): boolean {
    if(value.includes("-")) {
        return locales.has(value);
    }

    return false;
}

