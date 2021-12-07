import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";

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
        this.copiedPopup(event, vnode)
    },
    
    copiedPopup(event, vnode) {
        const el = event.target
        const rect = el.getBoundingClientRect();

        const displayedComponent = new ComponentWithProperties(Tooltip, {
            text: "Gekopieerd",
            icon: "success green",
            x: rect.left,
            y: rect.top + el.offsetHeight + 5
        });
        vnode.context.present(displayedComponent.setDisplayStyle("overlay"));

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
    },

    copyElement(event, bindingValue: any, vnode: any) {
        if (navigator.clipboard) {
            const myText = bindingValue ?? event.target.textContent;
            navigator.clipboard.writeText(myText).then(() => {
                this.copiedPopup(event, vnode);
            }).catch(() => {
                this.copyElementFallback(event, vnode);
            });
        } else {
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
