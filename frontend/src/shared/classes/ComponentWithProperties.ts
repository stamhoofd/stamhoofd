import Vue, { VNode } from "vue";

export class ComponentWithProperties {
    /// Name of component or component Options. Currently no way to force type
    public component: any;
    public properties: Object;
    public key: number | null = null;
    public type: string | null = null;
    public hide: boolean = false;

    /// Saved vnode of this instance
    public vnode: VNode | null = null;

    // Keep the vnode alive when it is removed from the VDOM
    public keepAlive: boolean = false;
    public mounted: boolean = false;

    constructor(component: any, properties: Object = {}) {
        this.component = component;
        this.properties = properties;
    }

    beforeMount() {
        console.log("Component mounted: " + this.component.name);

        this.mounted = true;
    }

    destroy() {
        this.mounted = false;

        if (this.vnode) {
            if (this.keepAlive) {
                console.log("Kept component alive " + this.component.name);
                this.keepAlive = false;
                return;
            }
            console.log("Destroyed component " + this.component.name);
            this.vnode.componentInstance.$destroy();
            this.vnode = null;
        }
    }
}
