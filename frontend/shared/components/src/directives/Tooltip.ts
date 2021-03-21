import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";

import Tooltip from "../overlays/Tooltip.vue";

export default {
    inserted(el, binding, vnode) {
        let isMouseHover = false;
        let displayedComponent: ComponentWithProperties | null = null;

        if (!binding.value) {
            return;
        }

        if ('ontouchstart' in window) {
            // Ignore on touch devices
            return;
        }

        // Add a hover listener
        el.addEventListener(
            "mouseenter",
            (_event) => {
                
                if (!isMouseHover) {
                    const parentComponent = vnode.context;

                    isMouseHover = true;

                    setTimeout(() => {
                        if (isMouseHover && !displayedComponent) {
                            const rect = el.getBoundingClientRect();

                            // Present

                            displayedComponent = new ComponentWithProperties(Tooltip, {
                                text: binding.value,
                                x: rect.left,
                                y: rect.top + el.offsetHeight + 5,
                            });
                            parentComponent.present(displayedComponent.setDisplayStyle("overlay"));
                            el.tooltipComponent = displayedComponent
                        }
                    }, 200);
                }
            },
            { passive: true }
        );
        el.addEventListener(
            "mouseleave",
            (_event) => {
                isMouseHover = false;

                if (displayedComponent && displayedComponent.vnode) {
                    // Todo: hide component again
                    try {
                        displayedComponent.vnode.componentInstance?.$parent.$emit("pop");
                    } catch (e) {
                        // Ignore
                    }
                }
                displayedComponent = null;
            },
            { passive: true }
        );
    },
};
