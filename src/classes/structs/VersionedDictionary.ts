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

    internalName(type: boolean): string {
        return this.name;
    }

    definition() {
        var defOther = "";
        return "type " + this.internalName(true) + " = " + this.versions.map((type) => {
            defOther += type.externalDefinition(this.namespace);
            return type.externalName(true, this.namespace);
        }).join(" | ") + ";\n" + defOther;
    }
}