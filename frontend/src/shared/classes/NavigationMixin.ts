// mixins.js
import { Component, Vue, Prop, Ref, Watch } from "vue-property-decorator";
import ComponentWithProperties from "./ComponentWithProperties";
import NavigationController from "../components/layout/NavigationController.vue";

// You can declare mixins as the same style as components.
@Component
export class NavigationMixin extends Vue {
    emitParents(event: string, data: any) {
        var start: any = this;
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

    showDetail(component: ComponentWithProperties) {
        this.emitParents("showDetail", component);
    }

    pop() {
        const nav = this.getPoppableNavigationController();
        if (nav) {
            nav.pop();
        } else {
            console.warn("No navigation controller to pop");
        }
    }

    getPoppableNavigationController(): NavigationController | null {
        var start: any = this.$parent;
        while (start) {
            if (start instanceof NavigationController) {
                if (start.components.length > 1) {
                    return start;
                }
            }

            start = start.$parent;
        }
        return null;
    }

    canPop: boolean = false;

    activated() {
        this.canPop = this.calcualteCanPop();
    }

    calcualteCanPop(): boolean {
        return this.getPoppableNavigationController() != null;
    }
}
