
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
            return "namespace " + this.namespace + " {\n" + this.definition() + "}\n";
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
}
