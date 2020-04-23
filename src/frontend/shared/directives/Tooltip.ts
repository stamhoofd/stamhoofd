import { ComponentWithProperties } from "@stamhoofd/shared/classes/ComponentWithProperties";
import Tooltip from "@stamhoofd/shared/components/overlays/Tooltip.vue";

export default {
    inserted(el, binding, vnode) {
        let isMouseHover = false;
        let displayedComponent: ComponentWithProperties | null = null;

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
                    displayedComponent.vnode.componentInstance?.$parent.$emit("pop");
                    displayedComponent = null;
                }
            },
            { passive: true }
        );
    },
};
