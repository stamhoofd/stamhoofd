import { ComponentWithProperties } from "shared/classes/ComponentWithProperties";
import Tooltip from "shared/components/overlays/Tooltip.vue";

export default {
    inserted(el, binding, vnode) {
        var isMouseHover = false;
        var displayedComponent = null;

        // Add a hover listener
        el.addEventListener(
            "mouseenter",
            event => {
                if (!isMouseHover) {
                    var parentComponent = vnode.context;

                    isMouseHover = true;

                    setTimeout(() => {
                        if (isMouseHover && !displayedComponent) {
                            var rect = el.getBoundingClientRect();

                            // Present

                            displayedComponent = new ComponentWithProperties(Tooltip, {
                                text: binding.value,
                                x: rect.left,
                                y: rect.top + el.offsetHeight + 5
                            });
                            parentComponent.present(displayedComponent.setDisplayStyle("overlay"));
                        }
                    }, 200);
                }
            },
            { passive: true }
        );
        el.addEventListener(
            "mouseleave",
            event => {
                isMouseHover = false;

                if (displayedComponent && displayedComponent.vnode) {
                    // Todo: hide component again
                    console.log("Pop");
                    displayedComponent.vnode.componentInstance.$parent.$emit("pop");
                    displayedComponent = null;
                }
            },
            { passive: true }
        );
    },
    componentUpdated(el, binding, vnode) {
        console.log(vnode);
    }
};
