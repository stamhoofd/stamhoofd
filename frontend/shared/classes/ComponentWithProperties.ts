export class ComponentWithProperties {
    /// Name of component or component Options. Currently no way to force type
    public component: any;
    public properties: Object;
    public key: number | null = null;
    public type: string | null = null;
    public hide: boolean = false;

    constructor(component: any, properties: Object = {}) {
        this.component = component;
        this.properties = properties;
    }
}
