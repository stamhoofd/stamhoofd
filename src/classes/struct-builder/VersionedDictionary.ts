import { Struct } from './Struct';
import { Dictionary } from './Dictionary';



export class VersionedDictionary extends Struct {
    versions: Dictionary[] = [];
    contentType: string;
    name: string

    constructor(base: Dictionary) {
        super();
        this.name = "All"
        this.namespace = base.name;
        this.contentType = base.contentType;
        this.addVersion(base)
    }

    get last(): Dictionary {
        return this.versions[this.versions.length - 1]
    }

    addVersion(base: Dictionary) {
        this.versions.push(base);
        base.contentType = this.contentType + ";version=" + this.versions.length;
        base.name = "Version" + this.versions.length;
    }

    internalName(_: boolean): string {
        return this.name;
    }

    definition() {
        let def = "";

        def += this.versions.map((type) => {
            return type.externalDefinition(this.namespace);
        }).join("\n")

        def += "\n";
        def += "export type " + this.internalName(true) + " = " + this.versions.map(type => type.externalName(true, this.namespace)).join(" | ") + ";\n";
        def += "export const all = [" + this.versions.map(type => type.externalName(true, this.namespace)) + "];\n";

        return def;
    }
}