export interface ColumnMatcher {
    id: string;
    
    getName(): string;
    getCategory(): string;
    doesMatch(columnName: string, examples: string[]): boolean;
}