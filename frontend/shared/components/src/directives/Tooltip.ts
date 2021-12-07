import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";

import Tooltip from "../overlays/Tooltip.vue";

export default {
    inserted(el, binding, vnode) {
        let isMouseHover = false;
        const displayedComponent: ComponentWithProperties | null = el.$tooltipDisplayedComponent ?? null;
        el.$tooltipDisplayedComponent = displayedComponent;

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
                        if (isMouseHover && !el.$tooltipDisplayedComponent) {
                            const rect = el.getBoundingClientRect();

                            // Present

                            el.$tooltipDisplayedComponent = new ComponentWithProperties(Tooltip, {
                                text: binding.value,
                                x: rect.left,
                                y: rect.top + el.offsetHeight,
                            });
                            parentComponent.present(el.$tooltipDisplayedComponent.setDisplayStyle("overlay"));
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

                if (el.$tooltipDisplayedComponent && el.$tooltipDisplayedComponent.vnode) {
                    try {
                        el.$tooltipDisplayedComponent.vnode.componentInstance?.$parent.$emit("pop");
                    } catch (e) {
                        // Ignore
                    }
                }
                el.$tooltipDisplayedComponent = null;
            },
            { passive: true }
        );
    },

    unbind(el, binding, vnode) {
        console.log("Unbind tooltip");
        if (el.$tooltipDisplayedComponent && el.$tooltipDisplayedComponent.vnode) {
            // Todo: hide component again
            console.log("Force hide in unbind")

            try {
                el.$tooltipDisplayedComponent.vnode.componentInstance?.$parent.$emit("pop");
            } catch (e) {
                // Ignore
            }
        }
        el.$tooltipDisplayedComponent = null;
    }
};
