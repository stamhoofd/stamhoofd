import fs from 'fs';
import path from 'path';

export abstract class Struct {
    didExport: boolean = false;
    namespace: string | null = null;

    abstract internalName(type: boolean): string

    externalName(type: boolean, otherNamespace: string | null = null): string {
        if (this.namespace && (!otherNamespace || otherNamespace != this.namespace)) {
            return this.namespace + "." + this.internalName(type);
        }
        return this.internalName(type);
    }

    protected abstract definition(): string;
    externalDefinition(otherNamespace: string | null = null): string {
        if (this.namespace && (!otherNamespace || otherNamespace != this.namespace)) {
            return "export namespace " + this.namespace + " {\n    " + this.definition().replace(/\n(?!$)/g, "\n    ") + "}\n";
        }
        return this.definition();
    }

    export(): string {
        if (this.didExport) {
            return "";
        }
        this.didExport = true;
        return this.externalDefinition();
    }

    static save(structs: Struct[], file: string) {
        const header = fs.readFileSync(path.join(__dirname, 'template.ts'), "utf8");
        fs.writeFileSync(file, header + "\n" + structs.map(struct => struct.export()).join("\n"));
    }
}
