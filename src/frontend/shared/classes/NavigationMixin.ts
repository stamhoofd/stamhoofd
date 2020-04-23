// mixins.js
import { Component, Vue } from "vue-property-decorator";

import NavigationController from "../components/layout/NavigationController.vue";
import SplitViewController from "../components/layout/SplitViewController.vue";
import { ComponentWithProperties } from "./ComponentWithProperties";

// You can declare mixins as the same style as components.
@Component
export class NavigationMixin extends Vue {
    emitParents(event: string, data: any) {
        let start: any = this;
        while (start.$parent) {
            if (start.$listeners[event]) {
                start.$emit(event, data);
                return;
            } else {
                start = start.$parent;
            }
        }
        console.warn("No handlers found for event " + event);
    }

    show(component: ComponentWithProperties) {
        this.emitParents("show", component);
    }

    present(component: ComponentWithProperties) {
        this.emitParents("present", component);
    }

    showDetail(component: ComponentWithProperties) {
        this.emitParents("showDetail", component);
    }

    pop() {
        const nav = this.getPoppableParent();
        if (nav) {
            // Sometimes we need to call the pop event instead (because this adds custom data to the event)
            if (nav.$listeners["pop"]) {
                nav.$emit("pop");
            } else {
                console.error("Couldn't pop. Failed");
            }
        } else {
            console.warn("No navigation controller to pop");
        }
    }

    get navigationController(): NavigationController | null {
        let start: any = this.$parent;
        while (start) {
            if (start instanceof NavigationController) {
                return start;
            }

            start = start.$parent;
        }
        return null;
    }

    get splitViewController(): SplitViewController | null {
        let start: any = this.$parent;
        while (start) {
            if (start instanceof SplitViewController) {
                return start;
            }

            start = start.$parent;
        }
        return null;
    }

    getPoppableParent(): any | null {
        let prev = this;
        let start: any = this.$parent;
        while (start) {
            // Todo: need to replace this with a dynamic check of the method "canPop" on all parents
            // Instead of instanceof checks
            if (start instanceof NavigationController) {
                if (start.components.length > 1) {
                    return prev;
                }
            } else if (prev.$listeners["pop"]) {
                return prev;
            }

            prev = start;
            start = start.$parent;
        }
        return null;
    }

    canPop = false;

    activated() {
        this.canPop = this.calculateCanPop();
    }

    calculateCanPop(): boolean {
        return this.getPoppableParent() != null;
    }
}
