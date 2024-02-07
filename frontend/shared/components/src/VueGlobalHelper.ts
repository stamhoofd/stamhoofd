import { Request } from "@simonbackx/simple-networking";
import { AppManager } from "@stamhoofd/networking";
import { Formatter } from "@stamhoofd/utility";
import Vue from "vue";

import { CopyableDirective, LongPressDirective,TooltipDirective } from "..";

declare module "vue/types/vue" {
    interface Vue {
        readonly $OS: "android" | "iOS" | "web" | "macOS" | "windows" | "unknown";
    }
}

/**
 * Return false if it should not cancel the default behaviour
 */
function focusNextElement () {
    const activeElement = document.activeElement as HTMLInputElement | undefined
    if (!activeElement) {
        return false
    }

    //add all elements we want to include in our selection
    const focussableElements = 'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button[type="submit"], button:not([type="button"])';
    if (activeElement && activeElement.form) {
        const focussable = Array.prototype.filter.call(activeElement.form.querySelectorAll(focussableElements),
            function (element) {
            //check for visibility while always include the current activeElement 
                return element.offsetWidth > 0 || element.offsetHeight > 0 || element === activeElement
            });
        const index = focussable.indexOf(activeElement);
        if(index > -1) {
            const nextElement = focussable[index + 1]
            if (!nextElement) {
                if (activeElement.form.hasAttribute("data-submit-last-field")) {
                    // don't blur, or the default handler won't work
                    return false
                }
                
                // On mobile, we'll just blur the last element and not submit, while on desktop we'll focus the submit button (which will be last)
                activeElement.blur()
                return true
            }

            if (nextElement.tagName === "BUTTON") {
                if (activeElement.form.hasAttribute("data-submit-last-field")) {
                    // don't blur, or the default handler won't work
                    return false
                }

                if (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || ((navigator as any).msMaxTouchPoints > 0)) {
                    // Don't focus buttons on mobile
                    activeElement.blur()
                    return true
                }

                // If the next element is a button, we'll add the class .focus-visible to it, as Safari doesn't support the :focus-visible pseudo-class on buttons
                nextElement.classList.add("focus-visible");

                // And we'll remove it again on blur, once
                nextElement.addEventListener("blur", function () {
                    nextElement.classList.remove("focus-visible");
                }, { once: true });
            }

            nextElement.focus();
        }                    
    }
    return true
}

export class VueGlobalHelper {
    static setup() {
        Vue.prototype.$isMobile = document.documentElement.clientWidth <= 550 || document.documentElement.clientHeight <= 400;
        Vue.prototype.$focusNext = () => {
            focusNextElement()
        }

        Vue.prototype.$OS = AppManager.shared.getOS()
        Vue.prototype.$isNative = AppManager.shared.isNative
        Vue.prototype.$isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || ((navigator as any).msMaxTouchPoints > 0)

        Vue.prototype.$isAndroid = Vue.prototype.$OS === "android"
        Vue.prototype.$isIOS = Vue.prototype.$OS === "iOS"
        Vue.prototype.$isMac = Vue.prototype.$OS === "macOS"

        Vue.prototype.pluralText = function(num: number, singular: string, plural: string) {
            return Formatter.pluralText(num, singular, plural)
        }

        document.addEventListener('keydown', (event) => {
            const element = event.target as HTMLInputElement;
            if (element && (element.tagName === 'INPUT' || element.tagName === 'SELECT') && element.form && !element.closest('[data-disable-enter-focus]')) {
                if (event.which === 13) {
                    if (focusNextElement() === true) {
                        event.preventDefault();
                    }
                }
            }
        })

        if (Vue.prototype.$OS === "android") {
            document.addEventListener('touchstart', (event) => {
                const target = event.target as HTMLElement
                if (target && target.tagName === 'BUTTON') {
                    target.classList.add("active");

                    window.setTimeout(() => {
                        target.classList.remove("active");
                    }, 250)
                }
            }, { passive: true })
        }

        Vue.mixin({
            directives: {
                tooltip: TooltipDirective,
                copyable: CopyableDirective,
                LongPress: LongPressDirective
            },
            filters: {
                price: Formatter.price.bind(Formatter),
                date: Formatter.date.bind(Formatter),
                dateTime: Formatter.dateTime.bind(Formatter)
            },
            beforeDestroy() {
                // Clear all pending requests
                Request.cancelAll(this)
            }
        })
    }
}
