import { Request } from "@simonbackx/simple-networking";
import { AppManager, SessionManager, UrlHelper } from "@stamhoofd/networking";
import { Formatter } from "@stamhoofd/utility";
import Vue, {type App} from "vue";

import { CopyableDirective, GlobalEventBus, LongPressDirective,TooltipDirective } from "..";
import { useCurrentComponent, injectHooks } from "@simonbackx/vue-app-navigation";

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
    static setup(app: App<Element>) {
        app.config.globalProperties.$country = "BE" // todo
        app.config.globalProperties.$isMobile = document.documentElement.clientWidth <= 550 || document.documentElement.clientHeight <= 400;
        app.config.globalProperties.$focusNext = () => {
            focusNextElement()
        }

        app.config.globalProperties.$OS = AppManager.shared.getOS()
        app.config.globalProperties.$isNative = AppManager.shared.isNative
        app.config.globalProperties.$isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || ((navigator as any).msMaxTouchPoints > 0)

        app.config.globalProperties.$isAndroid = app.config.globalProperties.$OS === "android"
        app.config.globalProperties.$isIOS = app.config.globalProperties.$OS === "iOS"
        app.config.globalProperties.$isMac = app.config.globalProperties.$OS === "macOS"

        app.config.globalProperties.pluralText = function(num: number, singular: string, plural: string) {
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

        if (app.config.globalProperties.$OS === "android") {
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

        app.mixin({
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
            inject: {
                $context: {
                    default: function () {
                        // console.warn('No session provided to component', this)
                        // if (!SessionManager.currentSession) {
                        //     console.error('No session available')
                        //     //throw new Error('No session available')
                        // }

                        return null; // SessionManager.currentSession
                    }
                },
                $organization: {
                    default: function () {
                        return null;
                    }
                },
                $user: {
                    default: function () {
                        return null;
                    }
                },
                $organizationManager: {
                    default: function () {
                        return null;
                    }
                },
                $memberManager: {
                    default: function () {
                        return null;
                    }
                },
                $webshopManager: {
                    default: function () {
                        return null;
                    }
                },
                $checkoutManager: {
                    default: function () {
                        return null;
                    }
                },
                urlPrefix: {
                    from: 'urlPrefix',
                    default: function () {
                        return null
                    }
                }
            },
            beforeUnmount() {
                // Clear all pending requests
                GlobalEventBus.removeListener(this)
                Request.cancelAll(this)
            },
            created() {
                const directives = {
                    currentComponent: useCurrentComponent()
                };

                injectHooks(this, directives)
            },
            methods: {
                formatPrice: Formatter.price.bind(Formatter),
                formatDate: Formatter.date.bind(Formatter),
                formatDateTime: Formatter.dateTime.bind(Formatter),
                formatPriceChange: Formatter.priceChange.bind(Formatter),
                formatMinutes: Formatter.minutes.bind(Formatter),
                capitalizeFirstLetter: Formatter.capitalizeFirstLetter.bind(Formatter),
                formatDateWithDay: Formatter.dateWithDay.bind(Formatter),
                formatTime: Formatter.time.bind(Formatter),
                setUrl(url: string) {
                    const component = this.currentComponent;
                    if (!component) {
                        console.error("No current component while setting url", url)
                        return;
                    }

                    // Local prefix?
                    const prefix = this.getUrlPrefix()
                    const transformed = UrlHelper.transformUrl(url, prefix)
                    console.log('setUrl', url, 'transformed to', transformed, 'with prefix', prefix)
                    component.setUrl(transformed)
                },
                getUrlPrefix(): string | null {
                    return this.urlPrefix || null
                },
                extendPrefix(url: string): string {
                    const prefix = this.getUrlPrefix()
                    if (prefix) {
                        console.log('extendPrefix', url, 'to', prefix + '/' + url)
                        return prefix + '/' + url
                    }
                    return url
                },
                urlMatch(template: string) {
                    const helper = new UrlHelper(UrlHelper.shared.url, this.getUrlPrefix())
                    const result = helper.match(template)

                    if (result) {
                        console.log('Matched', template, '@', this.getUrlPrefix(), 'with', helper.getPath({removePrefix: false}), 'result', result)
                    }

                    return result
                },
                clearUrl() {
                    UrlHelper.shared.clear()
                }
            }
        })
    }
}
