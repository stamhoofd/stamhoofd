import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";

import { ModalStackEventBus } from "../..";
import Tooltip from "../overlays/Tooltip.vue";

export default {
    bind(el, binding, vnode) {
        let isMouseHover = false;
        const displayedComponent: ComponentWithProperties | null = el.$tooltipDisplayedComponent ?? null;
        el.$tooltipDisplayedComponent = displayedComponent;

        if (!binding.value || typeof binding.value !== "string") {
            return;
        }

        if ('ontouchstart' in window) {
            // Ignore on touch devices
            return;
        }

        // Add a hover listener
        el.addEventListener(
            "mouseover",
            (_event) => {                
                if (!isMouseHover) {
                    isMouseHover = true;

                    setTimeout(() => {
                        if (isMouseHover && !el.$tooltipDisplayedComponent) {
                            const rect = el.getBoundingClientRect();

                            // Present
                            el.$tooltipDisplayedComponent = new ComponentWithProperties(Tooltip, {
                                text: binding.value,
                                x: rect.left,
                                y: rect.bottom,
                                xPlacement: "right",
                                yPlacement: "bottom",
                                wrapHeight: rect.height,
                            });

                            ModalStackEventBus.sendEvent("present", {
                                components: [
                                    el.$tooltipDisplayedComponent
                                ],
                                modalDisplayStyle: "overlay",
                            }).catch(console.error)
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
        if (el.$tooltipDisplayedComponent && el.$tooltipDisplayedComponent.vnode) {
            try {
                el.$tooltipDisplayedComponent.vnode.componentInstance?.$parent.$emit("pop");
            } catch (e) {
                // Ignore
            }
        }
        el.$tooltipDisplayedComponent = null;
    }
};
