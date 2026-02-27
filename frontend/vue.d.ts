import { FormatInputDirective } from '@stamhoofd/components/directives/FormatInputDirective';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n';
import { MemberManager, OrganizationManager, SessionContext } from '@stamhoofd/networking';
import { CountryHelper, Organization, Platform, User } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import Vue from 'vue';

export { };

declare module 'vue' {
    import { CompatVue } from 'vue';
    const Vue: CompatVue;
    export default Vue;
    export * from '@vue/runtime-dom';
}

declare module '*.vue' {
    export default Vue;
}

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
        $t: typeof import('@stamhoofd/frontend-i18n').I18n.prototype.$t;
        $feature: ReturnType<typeof import('@stamhoofd/components').useFeatureFlag>;

        /**
         * @deprecated
         * Only used for legacy code
         */
        $patchOrganizationPeriod: ReturnType<typeof import('@stamhoofd/networking').usePatchOrganizationPeriod>;

        $context: SessionContext;
        $organization: Organization;
        $platform: Platform;
        $user: User | null;
        $organizationManager: OrganizationManager;
        $memberManager: MemberManager;
        $app: ReturnType<typeof import('@stamhoofd/components').useAppContext>;
        STAMHOOFD: FrontendEnvironment;
        $domains: typeof LocalizedDomains;

        // Global components
        readonly STList: typeof import('@stamhoofd/components').STList;
        readonly STListItem: typeof import('@stamhoofd/components').STListItem;
        readonly STNavigationBar: typeof import('@stamhoofd/components').STNavigationBar;
        readonly STInputBox: typeof import('@stamhoofd/components').STInputBox;
        readonly STErrorsDefault: typeof import('@stamhoofd/components').STErrorsDefault;
        readonly SaveView: typeof import('@stamhoofd/components').SaveView;
        readonly Checkbox: typeof import('@stamhoofd/components').Checkbox;
        readonly Radio: typeof import('@stamhoofd/components').Radio;
        readonly LoadingView: typeof import('@stamhoofd/components').LoadingView;
        readonly Spinner: typeof import('@stamhoofd/components').Spinner;
        readonly LoadingButton: typeof import('@stamhoofd/components').LoadingButton;
        readonly STToolbar: typeof import('@stamhoofd/components').STToolbar;
        readonly TTextarea: typeof import('@stamhoofd/components').TTextarea;
        readonly TInput: typeof import('@stamhoofd/components').TInput;
        readonly I18nComponent: typeof import('@stamhoofd/frontend-i18n').I18nComponent;

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
        $t: typeof import('@stamhoofd/frontend-i18n').I18n.prototype.$t;
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
