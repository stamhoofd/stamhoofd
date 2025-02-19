export function wrapWithTranslationFunction(value: string): string {
    let quoteType = "'";

    if(value.includes("'")) {
        quoteType = value.includes('"') ? '`' : '"';
    } else if(value.includes('"')) {
        quoteType = '`';
    }

    return `$t(${quoteType}${value}${quoteType})`;
}
