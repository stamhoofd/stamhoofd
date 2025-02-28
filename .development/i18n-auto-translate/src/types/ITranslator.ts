export interface ITranslator {
    translate(text: string): Promise<string>;
    
}
