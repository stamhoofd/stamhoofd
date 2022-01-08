export class EditorSmartVariable {
    id: string;
    name: string;
    example: string;

    constructor(options: { id: string, name: string, example?: string }) {
        this.id = options.id;
        this.name = options.name;
        this.example = options.example ?? options.name;
    }
}