import type { FormatInputDirective } from '#directives/FormatInputDirective';
import type { LocalizedDomains } from '@stamhoofd/frontend-i18n/LocalizedDomains';
import type { MemberManager } from '@stamhoofd/networking/MemberManager';
import type { OrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { CountryHelper, Organization, Platform, User } from '@stamhoofd/structures';
import type { FrontendEnvironment } from '@stamhoofd/types/Environment';
import type { Formatter } from '@stamhoofd/utility';

export { };

/* declare module 'vue' {
    import type { CompatVue } from 'vue';
    const Vue: CompatVue;
    export default Vue;
    export * from '@vue/runtime-dom';
} */

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
        $feature: ReturnType<typeof import('#hooks/useFeatureFlag').useFeatureFlag>;

        $context: SessionContext;
        $organization: Organization;
        $platform: Platform;
        $user: User | null;
        $organizationManager: OrganizationManager;
        $memberManager: MemberManager;
        $app: ReturnType<typeof import('#context/appContext').useAppContext>;
        STAMHOOFD: FrontendEnvironment;
        $domains: typeof LocalizedDomains;

        // Global components
        readonly STList: typeof import('#layout/STList.vue');
        readonly STListItem: typeof import('#layout/STListItem.vue');
        readonly STNavigationBar: typeof import('#navigation/STNavigationBar.vue');
        readonly STInputBox: typeof import('#inputs/STInputBox.vue');
        readonly STErrorsDefault: typeof import('#errors/STErrorsDefault.vue');
        readonly SaveView: typeof import('#navigation/SaveView.vue');
        readonly Checkbox: typeof import('#inputs/Checkbox.vue');
        readonly Radio: typeof import('#inputs/Radio.vue');
        readonly LoadingView: typeof import('#containers/LoadingView.vue');
        readonly Spinner: typeof import('#Spinner.vue');
        readonly LoadingButton: typeof import('#navigation/LoadingButton.vue');
        readonly STToolbar: typeof import('#navigation/STToolbar.vue');
        readonly TTextarea: typeof import('#inputs/TTextarea.vue');
        readonly TInput: typeof import('#inputs/TInput.vue');
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
