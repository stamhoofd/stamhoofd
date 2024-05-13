import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods, patchContainsChanges,PatchType } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { injectHooks, useCurrentComponent, useUrl } from "@simonbackx/vue-app-navigation";
import { AppManager, ContextPermissions, SessionContext } from "@stamhoofd/networking";
import { Organization, Platform, User, Version } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { type App,computed, getCurrentInstance,inject, Ref, ref, toRef } from "vue";
import { configureCompat } from "vue";

import { Checkbox, CopyableDirective, GlobalEventBus, LoadingButton, LoadingView, LongPressDirective, Radio, SaveView, TooltipDirective } from "..";
import PromiseView from "./containers/PromiseView.vue";
import STErrorsDefault from "./errors/STErrorsDefault.vue";
import STInputBox from "./inputs/STInputBox.vue";
import STList from "./layout/STListBox.vue";
import STListItem from "./layout/STListItem.vue";
import STNavigationBar from "./navigation/STNavigationBar.vue";

export function useContext(): Ref<SessionContext> {
    const refOrReal = inject('$context', null) as SessionContext|null;
    return toRef(refOrReal) as Ref<SessionContext>
}

export function useUser(): Ref<User | null> {
    const context = useContext()
    return computed(() => context.value.user);
}

export function useOrganization(): Ref<Organization | null> {
    const context = useContext()
    return computed(() => context.value.organization);
}

export function usePlatform(): Ref<Platform> {
    return toRef(inject('$platform') as Platform)
}

export function useIsMobile(): boolean {
    const app = getCurrentInstance()!;
    return app.appContext.config.globalProperties.$isMobile;
}

export function useIsIOS(): boolean {
    const app = getCurrentInstance()!;
    return app.appContext.config.globalProperties.$isIOS;
}

export function useIsAndroid(): boolean {
    const app = getCurrentInstance()!;
    return app.appContext.config.globalProperties.$isAndroid;
}

const width = ref(document.documentElement.clientWidth);
window.addEventListener('resize', () => {
    width.value = document.documentElement.clientWidth;
}, { passive: true })

export function useDeviceWidth(): Ref<number> {
    return width;
}

export function usePatch<T extends AutoEncoder>(obj: T): {
    createPatch: () => AutoEncoderPatchType<T>,
    patched: Ref<T>, 
    patch: Ref<AutoEncoderPatchType<T>>,
    addPatch: (newPatch: PartialWithoutMethods<AutoEncoderPatchType<T>>) => void,
    hasChanges: Ref<boolean>
} {
    if (!obj) {
        throw new Error('Expected a reference with an initial value at usePatch')
    }
    const patch = ref("id" in obj ? obj.static.patch({id: obj.id}) : obj.static.patch({})) as Ref<AutoEncoderPatchType<T>>;

    return {
        createPatch: () => {
            return ("id" in obj ? obj.static.patch({id: obj.id}) : obj.static.patch({})) as AutoEncoderPatchType<T>;
        },
        patch,
        patched: computed(() => {
            return obj.patch(patch.value)
        }),
        addPatch: (newPatch: PartialWithoutMethods<AutoEncoderPatchType<T>>) => {
            patch.value = patch.value.patch(obj.static.patch(newPatch))
        },
        hasChanges: computed(() => {
            return patchContainsChanges(patch.value as PatchType<T>, obj, { version: Version })
        })
    }
}

export function useEmitPatch<T extends AutoEncoder>(props: any, emit: any, propName: string): { 
    createPatch: () => AutoEncoderPatchType<T>,
    patched: Ref<T>, 
    addPatch: (newPatch: PartialWithoutMethods<AutoEncoderPatchType<T>>) => void 
} {
    return {
        createPatch: () => {
            return ("id" in props[propName] ? props[propName].static.patch({id: props[propName].id}) : props[propName].static.patch({})) as AutoEncoderPatchType<T>;
        },
        patched: computed(() => props[propName]) as Ref<T>,
        addPatch: (newPatch: PartialWithoutMethods<AutoEncoderPatchType<T>>) => {
            emit('patch:' + propName, props[propName].static.patch(newPatch))
        }
    } as any
}

export function useAuth(): ContextPermissions {
    const context = useContext()
    return context.value.auth;
}

/**
 * Allows you to use the ContextPermissions object in a specific context (editing user permissions mostly)
 * without inheriting permissions if the user is also a global admin (which gives them full access to everything, but breaks editing permissions)
 */
export function useUninheritedPermissions(overrides?: {patchedUser?: User|Ref<User>, patchedOrganization?: Organization|Ref<Organization|null>, patchedPlatform?: Platform|Ref<Platform>}): ContextPermissions {
    const user = overrides?.patchedUser ?? useUser()
    const organization = overrides?.patchedOrganization ?? useOrganization()
    const platform = overrides?.patchedPlatform ?? usePlatform()

    return new ContextPermissions(user, organization, platform, {allowInheritingPermissions: false})
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
        configureCompat({ WATCH_ARRAY: false, COMPONENT_V_MODEL: false });

        (window as any).PromiseComponent = PromiseView
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

        // Register shared components
        app.component('STList', STList)
        app.component('STListItem', STListItem)
        app.component('STNavigationBar', STNavigationBar)
        app.component('STInputBox', STInputBox)
        app.component('STErrorsDefault', STErrorsDefault)
        app.component('SaveView', SaveView)
        app.component('Checkbox', Checkbox)
        app.component('Radio', Radio)
        app.component('LoadingView', LoadingView)
        app.component('LoadingButton', LoadingButton)

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
                    currentComponent: useCurrentComponent(),
                    $url: useUrl(),
                    $user: useUser(),
                    $organization: useOrganization(),
                    $context: useContext(),
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
                setUrl(url: string, title?: string) {
                    console.warn('old usage of this.setUrl, change to $url.setTitle and move url definitions to parent components')
                }
            }
        })
    }
}
