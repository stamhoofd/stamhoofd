import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";

import { ModalStackEventBus } from "../overlays/ModalStackEventBus";
import Tooltip from "../overlays/Tooltip.vue";

const helper = {
    copyElementFallback(event, vnode) {
        event.target.contentEditable = true;

        document.execCommand('selectAll', false);
        document.execCommand('copy')

        event.target.contentEditable = false;


        const w = window as any;
        if (w.getSelection) {
            if (w.getSelection().empty) {  // Chrome
                w.getSelection().empty();
            } else if (w.getSelection().removeAllRanges) {  // Firefox
                w.getSelection().removeAllRanges();
            }
        }
        this.copiedPopup(event, vnode);

        (document.activeElement as HTMLElement)?.blur()
    },
    
    copiedPopup(event) {
        const el = event.currentTarget || event.target
        const rect = el.getBoundingClientRect();

        const displayedComponent = new ComponentWithProperties(Tooltip, {
            text: "Gekopieerd naar klembord",
            icon: "",
            x: rect.left,
            y: rect.top + el.offsetHeight + 5
        });

        ModalStackEventBus.sendEvent("present", {
            components: [
                displayedComponent
            ],
            modalDisplayStyle: "overlay",
        }).catch(console.error)

        setTimeout(() => {
            displayedComponent.vnode?.componentInstance?.$parent.$emit("pop");
        }, 1000);

        if (el.$tooltipDisplayedComponent) {
            try {
                el.$tooltipDisplayedComponent.vnode.componentInstance?.$parent.$emit("pop");
                el.$tooltipDisplayedComponent = null;
            } catch (e) {
                // ignore
            }
        }
        el.$tooltipDisplayedComponent = displayedComponent;


        // Add style
        el.classList.add("copied");
        setTimeout(() => {
            el.classList.remove("copied");
        }, 500);
    },

    copyElement(event, bindingValue: any, vnode: any) {
        if (window.getSelection() !== null && window.getSelection()!.toString().length > 0) {
            return
        }
        if (navigator.clipboard) {
            // Select all
            const myText = bindingValue ?? event.currentTarget.textContent.trim();
            navigator.clipboard.writeText(myText).then(() => {
                this.copiedPopup(event, vnode);
            }).catch((e) => {
                console.error(e);
                this.copyElementFallback(event, vnode);
            });
        } else {
            console.warn("No navigator.clipboard support");
            this.copyElementFallback(event, vnode);
        }        
    },
};

export default {
     

    inserted(el, binding, vnode) {
        // Add a hover listener
        el.addEventListener(
            "click",
            (event) => {
                helper.copyElement(event, binding.value, vnode)
            },
            { passive: true }
        );
    },
};
