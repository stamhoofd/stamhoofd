export class TextToTranslateRef {
    private _didTry = false;
    private _defaultNamespaceTranslation: string | null = null;
    private _translation: string | null = null;

    get isTranslated(): boolean {
        return this._translation !== null;
    }

    get didTry(): boolean {
        return this._didTry;
    }

    get translation(): string {
        const translation = this._translation;
        if (translation === null) {
            throw new Error("Not translated.");
        }
        return translation;
    }

    constructor(
        readonly locale: string,
        readonly namespace: string,
        readonly id: string,
        readonly text: string,
    ) {}

    markDidTry() {
        this._didTry = true;
    }

    setTranslation(value: string) {
        this._translation = value;
    }
}
