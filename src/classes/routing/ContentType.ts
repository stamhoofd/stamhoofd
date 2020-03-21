interface Parameters {
    [key: string]: string;
}

export class ContentType {
    name: string;
    suffix: string | null = null; // json, xml, ... As in 
    parameters: Parameters = {}

    /// Construct from e.g. application/vnd.stamhoofd.Member+json;version=2
    constructor(name: string, suffix: string | null = null, parameters: Parameters | null = null) {
        this.name = name;
        this.suffix = suffix;
        if (parameters) {
            this.parameters = parameters;
        }
    }

    toString(): string {
        var params = "";
        for (const attribute in this.parameters) {
            if (this.parameters.hasOwnProperty(attribute)) {
                // todo: fix encoding here!
                params += ";" + attribute + "=" + this.parameters[attribute];
            }
        }
        return this.name + (this.suffix ? "+" + this.suffix : "") + params;
    }

    static fromString(text: string): ContentType {
        var split = text.split(";");
        var name = (split[0] || "").trim().toLowerCase();
        var suffix: string | null = null;
        var parameters: Parameters = {};

        const last = name.lastIndexOf("+");
        if (last != -1) {
            suffix = name.substr(last + 1);
            name = name.substr(0, last);
        }

        for (let index = 1; index < split.length; index++) {
            const parameter = split[index].trim();
            if (parameter.length > 0) {
                // According to MIME specs, the attribute doesn't contain equal signs, so we can safely take the first equal sign here
                const attributeIndex = parameter.indexOf('=');
                if (attributeIndex == -1) {
                    // Invalid content Type
                    throw new Error("Invalid Content-Type. Parameters do not contain equal sign.");
                }
                const attribute = parameter.substr(0, attributeIndex).toLowerCase();
                const value = parameter.substr(attributeIndex + 1);
                parameters[attribute] = value;
            }
        }
        return new ContentType(name, suffix, parameters);
    }

    removeSuffix(): ContentType {
        return new ContentType(this.name, null, this.parameters)
    }

    removeParameters(): ContentType {
        return new ContentType(this.name, this.suffix)
    }

    /// Compare only the parts that are set by this content Type
    matches(contentType: ContentType): boolean {
        if (contentType.name != this.name) {
            return false;
        }
        if (this.suffix != null && contentType.suffix != this.suffix) {
            return false;
        }

        for (const attribute in this.parameters) {
            if (this.parameters.hasOwnProperty(attribute)) {
                if (contentType.parameters[attribute] != this.parameters[attribute]) {
                    return false;
                }
            }
        }
        return true;
    }
}