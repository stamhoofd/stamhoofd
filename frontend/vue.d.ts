import { FormatInputDirective } from '@stamhoofd/components/src/directives/FormatInputDirective';
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
        readonly $OS: 'android' | 'iOS' | 'web' | 'macOS' | 'windows' | 'unknown';
        readonly $isNative: boolean;
        readonly $isTouch: boolean;
        readonly $isAndroid: boolean;
        readonly $isIOS: boolean;
        readonly $isMac: boolean;
        readonly $isMobile: boolean;
        readonly $t: typeof import('@stamhoofd/frontend-i18n').I18n.prototype.$t;
        readonly $feature: ReturnType<typeof import('@stamhoofd/components').useFeatureFlag>;

        readonly $context: SessionContext;
        readonly $organization: Organization;
        readonly $platform: Platform;
        readonly $user: User | null;
        readonly $organizationManager: OrganizationManager;
        readonly $memberManager: MemberManager;
        readonly $app: ReturnType<typeof import('@stamhoofd/components').useAppContext>;

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
        readonly LoadingButton: typeof import('@stamhoofd/components').LoadingButton;
        readonly STToolbar: typeof import('@stamhoofd/components').STToolbar;
        readonly STAMHOOFD: FrontendEnvironment;
        readonly $domains: typeof LocalizedDomains;

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
        pluralText: typeof Formatter.pluralText;

        vFormatInput: typeof FormatInputDirective;
    }
}
