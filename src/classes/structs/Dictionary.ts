import { Struct } from './Struct';

interface Keys {
    [key: string]: Struct;
}

export class Dictionary extends Struct {
    keys: Keys;
    name: string;
    namespace: string | null = null;
    contentType: string;

    constructor(name: string, keys: Keys) {
        super();
        this.name = name;
        this.keys = keys;
        this.contentType = "application/vnd.stamhoofd." + this.name + "+json";
    }

    upgrade(): Dictionary {
        return this;
    }

    remove(removedKeys: string[]): Dictionary {
        var keys = {};
        for (const key in this.keys) {
            if (this.keys.hasOwnProperty(key)) {
                if (!removedKeys.includes(key)) {
                    const struct = this.keys[key];
                    keys[key] = struct;
                }
            }
        }

        return new Dictionary(this.name, keys)
    }

    add(addedKeys: Keys): Dictionary {
        var keys = Object.assign({}, this.keys);

        for (const key in addedKeys) {
            if (addedKeys.hasOwnProperty(key)) {
                const struct = addedKeys[key];
                keys[key] = struct;
            }
        }
        return new Dictionary(this.name, keys)
    }

    internalName(type: boolean): string {
        return this.name;
    }

    getContentType(): string {
        return this.contentType;
    }

    definition() {
        var defOther = "";
        var def = "class " + this.internalName(true) + " /* static implements ContentEncoder<" + this.internalName(true) + ", any>, ContentDecoder<Data, " + this.internalName(true) + "> */{\n"

        for (const key in this.keys) {
            if (this.keys.hasOwnProperty(key)) {
                const struct = this.keys[key];
                defOther += struct.export();
                def += "    " + key + ": " + struct.externalName(true) + "\n";
            }
        }

        // getContentTypes
        def += "\n    " + "static getContentTypes(): string[] {\n" + "    " + "    " + "return [\"" + this.getContentType() + "\"];\n" + "    " + "}\n";

        // decodeContent
        def += "\n    " + "static decodeContent(contentType: string, data: Data): " + this.internalName(true) + " {\n"
        def += "    " + "    " + "const d = new " + this.internalName(true) + "();\n";

        for (const key in this.keys) {
            if (this.keys.hasOwnProperty(key)) {
                const struct = this.keys[key];

                def += "    " + "    " + "d." + key + " = data.field(\"" + key + "\").cast(" + struct.externalName(false, this.namespace) + ");\n";
            }
        }
        def += "    " + "    " + "return d;\n";
        def += "    " + "}\n";

        // encodeContent
        def += "\n    " + "static encodeContent(contentType: string, data: " + this.internalName(true) + "): any {\n"
        def += "    " + "    " + "return this;\n";
        def += "    " + "}\n";

        def += "}\n";

        return def; //+ defOther;

    }
}