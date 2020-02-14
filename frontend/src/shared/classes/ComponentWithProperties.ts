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
    public isMounted: boolean = false;

    // Counter for debugging. Count of components that are kept alive but are not mounted.
    static keepAliveCounter: number = 0;
    static keyCounter: number = 0;

    constructor(component: any, properties: Object = {}) {
        this.component = component;
        this.properties = properties;
        this.key = ComponentWithProperties.keyCounter++;
    }

    beforeMount() {
        if (this.vnode) {
            ComponentWithProperties.keepAliveCounter--;
            console.log("Total components kept alive: " + ComponentWithProperties.keepAliveCounter);
        }
    }

    mounted() {
        console.log("Component mounted: " + this.component.name);
        this.isMounted = true;
    }

    destroy() {
        this.isMounted = false;

        if (this.vnode) {
            if (this.keepAlive) {
                this.keepAlive = false;
                ComponentWithProperties.keepAliveCounter++;
                console.log("Kept component alive " + this.component.name);
                console.log("Total components kept alive: " + ComponentWithProperties.keepAliveCounter);

                return;
            }
            console.log("Destroyed component " + this.component.name);
            this.vnode.componentInstance.$destroy();
            this.vnode = null;
        }
    }
}
