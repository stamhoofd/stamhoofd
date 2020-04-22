export class Formatter {
    static slug(name: string): string {
        return name.toLowerCase().replace(/[^a-z0-9]+/, "-").replace(/^-+/, "").replace(/-+$/, "")
    }
}