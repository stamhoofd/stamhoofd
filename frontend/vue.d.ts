import type { FormatInputDirective } from '@stamhoofd/components/directives/FormatInputDirective';
import type { LocalizedDomains } from '@stamhoofd/frontend-i18n';
import type { MemberManager, OrganizationManager, SessionContext } from '@stamhoofd/networking';
import type { CountryHelper, Organization, Platform, User } from '@stamhoofd/structures';
import type { Formatter } from '@stamhoofd/utility';

export { };

/*declare module 'vue' {
    import type { CompatVue } from 'vue';
    const Vue: CompatVue;
    export default Vue;
    export * from '@vue/runtime-dom';
}*/

declare module 'vue' {
    interface ComponentCustomProperties {
        $OS: 'android' | 'iOS' | 'web' | 'macOS' | 'windows' | 'unknown';
        $isNative: boolean;
        $isTouch: boolean;
        $isAndroid: boolean;
        $isIOS: boolean;
        $isMac: boolean;
        $isMobile: boolean;
        $isStamhoofd: boolean;
        $isPlatform: boolean;
        $t: typeof import('@stamhoofd/frontend-i18n/I18n').I18n.prototype.$t;
        $feature: ReturnType<typeof import('@stamhoofd/components/hooks/useFeatureFlag').useFeatureFlag>;

        /**
         * @deprecated
         * Only used for legacy code
         */
        $patchOrganizationPeriod: ReturnType<typeof import('@stamhoofd/networking/hooks/usePatchOrganizationPeriod').usePatchOrganizationPeriod>;

        $context: SessionContext;
        $organization: Organization;
        $platform: Platform;
        $user: User | null;
        $organizationManager: OrganizationManager;
        $memberManager: MemberManager;
        $app: ReturnType<typeof import('@stamhoofd/components/context/appContext').useAppContext>;
        STAMHOOFD: FrontendEnvironment;
        $domains: typeof LocalizedDomains;

        // Global components
        readonly STList: typeof import('@stamhoofd/components/layout/STList.vue');
        readonly STListItem: typeof import('@stamhoofd/components/layout/STListItem.vue');
        readonly STNavigationBar: typeof import('@stamhoofd/components/navigation/STNavigationBar.vue');
        readonly STInputBox: typeof import('@stamhoofd/components/inputs/STInputBox.vue');
        readonly STErrorsDefault: typeof import('@stamhoofd/components/errors/STErrorsDefault.vue');
        readonly SaveView: typeof import('@stamhoofd/components/navigation/SaveView.vue');
        readonly Checkbox: typeof import('@stamhoofd/components/inputs/Checkbox.vue');
        readonly Radio: typeof import('@stamhoofd/components/inputs/Radio.vue');
        readonly LoadingView: typeof import('@stamhoofd/components/containers/LoadingView.vue');
        readonly Spinner: typeof import('@stamhoofd/components/Spinner.vue');
        readonly LoadingButton: typeof import('@stamhoofd/components/navigation/LoadingButton.vue');
        readonly STToolbar: typeof import('@stamhoofd/components/navigation/STToolbar.vue');
        readonly TTextarea: typeof import('@stamhoofd/components/inputs/TTextarea.vue');
        readonly TInput: typeof import('@stamhoofd/components/inputs/TInput.vue');
        readonly I18nComponent: typeof import('@stamhoofd/frontend-i18n/I18nComponent');

        // Formatters
        formatPrice: typeof Formatter.price;
        formatDate: typeof Formatter.date;
        formatDateRange: typeof Formatter.dateRange;
        formatStartDate: typeof Formatter.startDate;
        formatEndDate: typeof Formatter.endDate;
        formatDateTime: typeof Formatter.dateTime;
        formatPriceChange: typeof Formatter.priceChange;
        formatMinutes: typeof Formatter.minutes;
        capitalizeFirstLetter: typeof Formatter.capitalizeFirstLetter;
        formatDateWithDay: typeof Formatter.dateWithDay;
        formatTime: typeof Formatter.time;
        formatCountry: typeof CountryHelper.getName;
        formatInteger: typeof Formatter.integer;
        formatFloat: typeof Formatter.float;
        formatPercentage: typeof Formatter.percentage;
        pluralText: typeof Formatter.pluralText;

        vFormatInput: typeof FormatInputDirective;
    }
}

// Make sure VueComponent from '@simonbackx/vue-app-navigation/classes' has a property named $t
declare module '@simonbackx/vue-app-navigation/classes' {
    interface VueComponent {
        $t: typeof import('@stamhoofd/frontend-i18n/I18n').I18n.prototype.$t;
        $attrs: any;
        $props: any;
        $: any;
        $emit: any;
        $slots: any;
        $refs: any;
        $nextTick: any;
        $isMobile: boolean;
        $el: HTMLElement;
        $parent: any;
    }
}
