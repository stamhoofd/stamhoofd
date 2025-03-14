type QuoteType = ('"' | "'" | '`');

export function wrapWithTranslationFunction(value: string, skipQuoteTypes?: QuoteType []): string {
    let quoteType = "'";

    const hasQuoteType = (quoteType: QuoteType) => value.includes(quoteType) || !!skipQuoteTypes?.includes(quoteType);

    if(hasQuoteType("'")) {
        quoteType = hasQuoteType('"') ? '`' : '"';
    } else if(hasQuoteType('"')) {
        quoteType = '`';
    }

    return `$t(${quoteType}${value}${quoteType})`;
}
