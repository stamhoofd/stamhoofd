import { VNode } from "vue";

export class ComponentWithProperties {
    /// Name of component or component Options. Currently no way to force type
    public component: any;
    public properties: Record<string, any>;
    public key: number | null = null;
    public type: string | null = null;
    public hide = false;

    /// Saved vnode of this instance
    public vnode: VNode | null = null;

    // Keep the vnode alive when it is removed from the VDOM
    public keepAlive = false;
    public isMounted = false;

    // Counter for debugging. Count of components that are kept alive but are not mounted.
    static keepAliveCounter = 0;
    static keyCounter = 0;

    /// Cover whole screen. Other style = popup
    public modalDisplayStyle = "cover";

    constructor(component: any, properties: Record<string, any> = {}) {
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

    setDisplayStyle(style: string): ComponentWithProperties {
        this.modalDisplayStyle = style;
        return this;
    }
}
