import { AppManager } from "@stamhoofd/networking";
import Vue from "vue";

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
        console.log(focussable)
        const index = focussable.indexOf(activeElement);
        if(index > -1) {
            const nextElement = focussable[index + 1]
            if (!nextElement) {
                // On mobile, we'll just blur the last element and not submit, while on desktop we'll focus the submit button (which will be last)
                if (document.documentElement.clientWidth <= 500) {
                    activeElement.blur()
                    return true
                }
                return false
            }
            nextElement.focus();
        }                    
    }
    return true
}

export class VueGlobalHelper {
    static setup() {
        Vue.prototype.$isMobile = document.documentElement.clientWidth <= 500;
        Vue.prototype.$focusNext = () => {
            focusNextElement()
        }

        Vue.prototype.$OS = ((): "android" | "iOS" | "web" | "macOS" | "windows" | "unknown" => {
            if (AppManager.shared.platform === "ios") {
                return "iOS"
            }

            if (AppManager.shared.platform === "android") {
                return "android"
            }

            const userAgent = navigator.userAgent || navigator.vendor;

            if (/android/i.test(userAgent)) {
                return "android";
            }

            if (/Mac OS X 10_14|Mac OS X 10_13|Mac OS X 10_12|Mac OS X 10_11|Mac OS X 10_10|Mac OS X 10_9/.test(userAgent)) {
                // Different sms protocol
                return "macOS";
            }

            // iOS detection from: http://stackoverflow.com/a/9039885/177710
            if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
                return "iOS";
            }

            // iPad on iOS 13 detection
            if (navigator.userAgent.includes("Mac") && "ontouchend" in document) {
                return "iOS";
            }

            if (navigator.platform.toUpperCase().indexOf('MAC')>=0 ) {
                return "macOS";
            }

            if (navigator.platform.toUpperCase().indexOf('WIN')>=0 ) {
                return "windows";
            }

            if (navigator.platform.toUpperCase().indexOf('IPHONE')>=0 ) {
                return "iOS";
            }

            if (navigator.platform.toUpperCase().indexOf('ANDROID')>=0 ) {
                return "android";
            }

            return "unknown"
    
        })()

        document.addEventListener('keydown', (event) => {
            const element = event.target as HTMLInputElement;
            if (element && (element.tagName === 'INPUT' || element.tagName === 'SELECT') && element.form) {
                if (event.which === 13) {
                    console.log("Enter pressed")
                    if (focusNextElement() === true) {
                        console.log("Prevent default")
                        event.preventDefault();
                    }
                }
            }
        })
    }
}
