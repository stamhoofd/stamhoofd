import { Request } from '@simonbackx/simple-networking';
import { injectHooks, useCurrentComponent, useUrl } from '@simonbackx/vue-app-navigation';
import { AppManager, usePatchOrganizationPeriod } from '@stamhoofd/networking';
import { CountryHelper } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { type App } from 'vue';

import { LocalizedDomains } from '@stamhoofd/frontend-i18n';
import { Checkbox, CopyableDirective, GlobalEventBus, LoadingButton, LoadingView, LongPressDirective, Radio, SaveView, Spinner, STList, STToolbar, TooltipDirective, useAppContext } from '..';
import PromiseView from './containers/PromiseView.vue';
import { ColorDirective } from './directives/ColorDirective';
import { FormatInputDirective } from './directives/FormatInputDirective';
import STErrorsDefault from './errors/STErrorsDefault.vue';
import { useContext, useFeatureFlag, useOrganization, usePlatform, useUser } from './hooks';
import STInputBox from './inputs/STInputBox.vue';
import STListItem from './layout/STListItem.vue';
import STNavigationBar from './navigation/STNavigationBar.vue';
import TTextarea from './inputs/TTextarea.vue';
import TInput from './inputs/TInput.vue';
import { format } from 'libphonenumber-js';

export type ComponentExposed<T> =
	T extends new (...args: any[]) => infer E ? E :
	    T extends ((props: any, ctx: any, expose: (exposed: infer E) => any, ...args: any[]) => any) ? NonNullable<E> :
	        object;

/**
 * Return false if it should not cancel the default behaviour
 */
function focusNextElement() {
    const activeElement = document.activeElement as HTMLInputElement | undefined;
    if (!activeElement) {
        return false;
    }

    // add all elements we want to include in our selection
    const focussableElements = 'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button[type="submit"], button:not([type="button"])';
    if (activeElement && activeElement.form) {
        const focussable = Array.prototype.filter.call(activeElement.form.querySelectorAll(focussableElements),
            function (element) {
            // check for visibility while always include the current activeElement
                return element.offsetWidth > 0 || element.offsetHeight > 0 || element === activeElement;
            });
        const index = focussable.indexOf(activeElement);
        if (index > -1) {
            const nextElement = focussable[index + 1];
            if (!nextElement) {
                if (activeElement.form.hasAttribute('data-submit-last-field')) {
                    // don't blur, or the default handler won't work
                    return false;
                }

                // On mobile, we'll just blur the last element and not submit, while on desktop we'll focus the submit button (which will be last)
                activeElement.blur();
                return true;
            }

            if (nextElement.tagName === 'BUTTON') {
                if (activeElement.form.hasAttribute('data-submit-last-field')) {
                    // don't blur, or the default handler won't work
                    return false;
                }

                if (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || ((navigator as any).msMaxTouchPoints > 0)) {
                    // Don't focus buttons on mobile
                    activeElement.blur();
                    return true;
                }

                // If the next element is a button, we'll add the class .focus-visible to it, as Safari doesn't support the :focus-visible pseudo-class on buttons
                nextElement.classList.add('focus-visible');

                // And we'll remove it again on blur, once
                nextElement.addEventListener('blur', function () {
                    nextElement.classList.remove('focus-visible');
                }, { once: true });
            }

            nextElement.focus();
        }
    }
    return true;
}

export class VueGlobalHelper {
    static setup(app: App<Element>) {
        (window as any).PromiseComponent = PromiseView;
        app.config.globalProperties.$country = 'BE'; // todo
        app.config.globalProperties.$isMobile = document.documentElement.clientWidth <= 550 || document.documentElement.clientHeight <= 400;
        app.config.globalProperties.$focusNext = () => {
            focusNextElement();
        };

        app.config.globalProperties.$OS = AppManager.shared.getOS();
        app.config.globalProperties.$isNative = AppManager.shared.isNative;
        app.config.globalProperties.$isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || ((navigator as any).msMaxTouchPoints > 0);

        app.config.globalProperties.$isAndroid = app.config.globalProperties.$OS === 'android';
        app.config.globalProperties.$isIOS = app.config.globalProperties.$OS === 'iOS';
        app.config.globalProperties.$isMac = app.config.globalProperties.$OS === 'macOS';
        app.config.globalProperties.$isStamhoofd = STAMHOOFD.platformName.toLocaleLowerCase() == 'stamhoofd';
        app.config.globalProperties.STAMHOOFD = STAMHOOFD;
        app.config.globalProperties.$domains = LocalizedDomains;

        app.config.globalProperties.pluralText = function (num: number, singular: string, plural: string) {
            return Formatter.pluralText(num, singular, plural);
        };

        app.config.warnHandler = function (msg, instance, trace) {
            // Shorter error message because the trace is complete garbage
            console.warn(msg, instance);
        };

        // Register shared components
        app.component('STList', STList);
        app.component('STListItem', STListItem);
        app.component('STNavigationBar', STNavigationBar);
        app.component('STInputBox', STInputBox);
        app.component('STErrorsDefault', STErrorsDefault);
        app.component('SaveView', SaveView);
        app.component('Checkbox', Checkbox);
        app.component('Radio', Radio);
        app.component('LoadingView', LoadingView);
        app.component('LoadingButton', LoadingButton);
        app.component('STToolbar', STToolbar);
        app.component('Spinner', Spinner);
        app.component('TTextarea', TTextarea);
        app.component('TInput', TInput);

        document.addEventListener('keydown', (event) => {
            const element = event.target as HTMLInputElement;
            if (element && (element.tagName === 'INPUT' || element.tagName === 'SELECT') && element.form && !element.closest('[data-disable-enter-focus]')) {
                if (event.which === 13) {
                    if (focusNextElement() === true) {
                        event.preventDefault();
                    }
                }
            }
        });

        if (app.config.globalProperties.$OS === 'android') {
            document.addEventListener('touchstart', (event) => {
                const target = event.target as HTMLElement;
                if (target && target.tagName === 'BUTTON') {
                    target.classList.add('active');

                    window.setTimeout(() => {
                        target.classList.remove('active');
                    }, 250);
                }
            }, { passive: true });
        }

        app.mixin({
            directives: {
                tooltip: TooltipDirective,
                copyable: CopyableDirective,
                LongPress: LongPressDirective,
                color: ColorDirective,
                formatInput: FormatInputDirective,
            },
            filters: {
                price: Formatter.price.bind(Formatter),
                date: Formatter.date.bind(Formatter),
                dateTime: Formatter.dateTime.bind(Formatter),
            },
            inject: {
                $context: {
                    default: function () {
                        return null;
                    },
                },
                $organizationManager: {
                    default: function () {
                        return null;
                    },
                },
                $memberManager: {
                    default: function () {
                        return null;
                    },
                },
                $webshopManager: {
                    default: function () {
                        return null;
                    },
                },
                $checkoutManager: {
                    default: function () {
                        return null;
                    },
                },
                urlPrefix: {
                    from: 'urlPrefix',
                    default: function () {
                        return null;
                    },
                },
            },
            beforeUnmount() {
                // Clear all pending requests
                GlobalEventBus.removeListener(this);
                Request.cancelAll(this);
            },
            created() {
                const directives = {
                    currentComponent: useCurrentComponent(),
                    $url: useUrl(),
                    $user: useUser(),
                    $organization: useOrganization(),
                    $context: useContext(),
                    $platform: usePlatform(),
                    $app: useAppContext(),
                    $feature: useFeatureFlag(),

                    // Temporary for legacy code
                    $patchOrganizationPeriod: usePatchOrganizationPeriod(),
                };

                injectHooks(this, directives);
            },
            methods: {
                formatPrice: Formatter.price.bind(Formatter),
                formatDate: Formatter.date.bind(Formatter),
                formatDateRange: Formatter.dateRange.bind(Formatter),
                formatStartDate: Formatter.startDate.bind(Formatter),
                formatEndDate: Formatter.endDate.bind(Formatter),
                formatDateTime: Formatter.dateTime.bind(Formatter),
                formatPriceChange: Formatter.priceChange.bind(Formatter),
                formatMinutes: Formatter.minutes.bind(Formatter),
                capitalizeFirstLetter: Formatter.capitalizeFirstLetter.bind(Formatter),
                formatDateWithDay: Formatter.dateWithDay.bind(Formatter),
                formatTime: Formatter.time.bind(Formatter),
                setUrl(url: string, title?: string) {
                    console.warn('old usage of this.setUrl, change to $url.setTitle and move url definitions to parent components');
                },
                formatCountry: CountryHelper.getName.bind(CountryHelper),
                formatInteger: Formatter.integer.bind(Formatter),
                formatFloat: Formatter.float.bind(Formatter),
                formatPercentage: Formatter.percentage.bind(Formatter),
                pluralText: Formatter.pluralText.bind(Formatter),
            },
        });
    }
}
