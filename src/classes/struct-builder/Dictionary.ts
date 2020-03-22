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
        this.contentType = "application/vnd.stamhoofd." + this.name;
    }

    upgrade(): Dictionary {
        return this;
    }

    remove(removedKeys: string[]): Dictionary {
        const keys = {};
        for (const key in this.keys) {
            if (Object.prototype.hasOwnProperty.call(this.keys, key)) {
                if (!removedKeys.includes(key)) {
                    const struct = this.keys[key];
                    keys[key] = struct;
                }
            }
        }

        return new Dictionary(this.name, keys)
    }

    add(addedKeys: Keys): Dictionary {
        const keys = Object.assign({}, this.keys);

        for (const key in addedKeys) {
            if (Object.prototype.hasOwnProperty.call(addedKeys, key)) {
                const struct = addedKeys[key];
                keys[key] = struct;
            }
        }
        return new Dictionary(this.name, keys)
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    internalName(type: boolean): string {
        return this.name;
    }

    getContentType(): string {
        return this.contentType;
    }

    definition() {
        let def = "export class " + this.internalName(true) + " /* static implements ContentEncoder<" + this.internalName(true) + ", any>, ContentDecoder<Data, " + this.internalName(true) + "> */{\n"

        for (const key in this.keys) {
            if (Object.prototype.hasOwnProperty.call(this.keys, key)) {
                const struct = this.keys[key];
                def += "    " + key + ": " + struct.externalName(true) + "\n";
            }
        }

        // getContentTypes
        def += "\n    " + "static getContentTypes(): ContentType[] {\n" + "    " + "    " + "return [ContentType.fromString(\"" + this.getContentType() + "\")];\n" + "    " + "}\n";

        // decodeContent
        def += "\n    " + "static decode(data: Data): " + this.internalName(true) + " {\n"
        def += "    " + "    " + "const d = new " + this.internalName(true) + "();\n";

        for (const key in this.keys) {
            if (Object.prototype.hasOwnProperty.call(this.keys, key)) {
                const struct = this.keys[key];

                def += "    " + "    " + "d." + key + " = data.field(\"" + key + "\").decode(" + struct.externalName(false, this.namespace) + ");\n";
            }
        }
        def += "    " + "    " + "return d;\n";
        def += "    " + "}\n";

        def += "\n    " + "static decodeContent(contentType: ContentType, data: Data): " + this.internalName(true) + " {\n"
        def += "    " + "    " + "return " + this.internalName(true) + ".decode(data);\n";
        def += "    " + "}\n";


        // encodeContent
        def += "\n    " + "static encodeContent(contentType: ContentType, data: " + this.internalName(true) + "): any {\n"
        def += "    " + "    " + "return this;\n";
        def += "    " + "}\n";

        def += "}\n";

        return def; //+ defOther;

    }
}