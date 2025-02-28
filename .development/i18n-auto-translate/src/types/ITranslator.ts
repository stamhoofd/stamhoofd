export interface ITranslator {
    translate(args: {text: string, originalLocal: string, targetLocal: string}): Promise<string>;
    
}
