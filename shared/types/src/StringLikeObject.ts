export interface StringLikeObject {
    toString(): string;
    trim(): string;
    toLocaleLowerCase(): string;
    toLocaleUpperCase(): string;
    toUpperCase(): string;
    toLowerCase(): string;
    substr(start: number, length?: number): string;
    substring(start: number, end?: number): string;
    length: number;
    valueOf(): string;
    normalize(form?: string): string;
    replace(searchValue: string | RegExp, replaceValue: string): string;
    charAt(index: number): string;
    slice(start: number, end?: number): string;
    split(separator: string | RegExp, limit?: number): string[];
}
