import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, EnumDecoder, field, IntegerDecoder, MapDecoder, NumberDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

import { Colors, Formatter } from '@stamhoofd/utility';
import { DefaultAgeGroup } from './DefaultAgeGroup.js';
import { Replacement } from './endpoints/EmailRequest.js';
import { EventNotificationType } from './EventNotificationType.js';
import { Image } from './files/Image.js';
import { LoginMethod, LoginMethodConfig } from './LoginMethod.js';
import { MemberResponsibility } from './MemberResponsibility.js';
import { DataPermissionsSettings, FinancialSupportSettings, OrganizationRecordsConfiguration } from './members/OrganizationRecordsConfiguration.js';
import { OrganizationEmail } from './OrganizationEmail.js';
import { OrganizationLevelRecordsConfiguration } from './OrganizationLevelRecordsConfiguration.js';
import { PermissionRoleDetailed } from './PermissionRole.js';
import { ReduceablePrice } from './ReduceablePrice.js';
import { RegistrationPeriod } from './RegistrationPeriod.js';
import { RichText } from './RichText.js';
import { User } from './User.js';
import { upgradePriceFrom2To4DecimalPlaces } from './upgradePriceFrom2To4DecimalPlaces.js';

export class PlatformPrivateConfig extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(PermissionRoleDetailed) })
    roles: PermissionRoleDetailed[] = [];

    @field({ decoder: new ArrayDecoder(OrganizationEmail), version: 272 })
    emails: OrganizationEmail[] = [];
}

export enum OrganizationTagType {
    Tag = 'Tag',
    Verbond = 'Verbond',
    Gewest = 'Gewest',
    Gouw = 'Gouw',
}

export function getOrganizationTagTypeName(type: OrganizationTagType): string {
    switch (type) {
        case OrganizationTagType.Tag:
            return $t(`fe29857c-e4ac-4b25-aa0e-31813f3570c2`);
        case OrganizationTagType.Verbond:
            return $t(`54979c74-008d-4435-a9a7-49ac63b4352e`);
        case OrganizationTagType.Gewest:
            return $t(`e0517811-de10-4974-9818-efd3570aefe6`);
        case OrganizationTagType.Gouw:
            return $t(`c100e695-9562-49cc-a979-49fc1bf636f6`);
    }
}

export function getOrganizationTagTypePluralName(type: OrganizationTagType): string {
    switch (type) {
        case OrganizationTagType.Tag:
            return $t(`e80487d1-d969-41fe-b2e8-59192e639fbb`);
        case OrganizationTagType.Verbond:
            return $t(`462860e4-8b8f-42b8-942c-9465e20d24a9`);
        case OrganizationTagType.Gewest:
            return $t(`56808421-5e4f-4139-9035-9f2a35bb924f`);
        case OrganizationTagType.Gouw:
            return $t(`b735d3ab-9a13-402b-8b21-0c231b4c1073`);
    }
}

export class OrganizationTag extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder, version: 341 })
    description = '';

    @field({ decoder: IntegerDecoder, version: 341 })
    organizationCount = 0;

    @field({ decoder: new ArrayDecoder(StringDecoder), version: 341 })
    childTags: string[] = [];

    get type() {
        if (this.name.startsWith('Verbond ')) {
            return OrganizationTagType.Verbond;
        }

        if (this.name.startsWith('Gewest ')) {
            return OrganizationTagType.Gewest;
        }

        return OrganizationTagType.Tag;
    }

    getChildType(allTags: OrganizationTag[]) {
        if (this.childTags.length === 0) {
            return OrganizationTagType.Tag;
        }

        const childTag = allTags.find(t => t.id === this.childTags[0]);
        if (!childTag) {
            return OrganizationTagType.Tag;
        }

        return childTag.type;
    }
}

export class PlatformPremiseType extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder, version: 319 })
    description = '';

    /**
     * Maximum number of premises allowed for this premise type
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 319 })
    max: null | number = null;

    /**
    * Minimum number of premises allowed for this premise type
    */
    @field({ decoder: IntegerDecoder, nullable: true, version: 319 })
    min: null | number = null;
}

export class PlatformMembershipTypeConfigPrice extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: DateDecoder, nullable: true })
    startDate: Date | null = null;

    /**
     *@deprecated
     */
    @field({ decoder: IntegerDecoder, field: 'price', optional: true })
    _price = 0;

    // key = tag id or an empty string for the default reducable price
    @field({ decoder: new MapDecoder(StringDecoder, ReduceablePrice), version: 329 })
    prices: Map<string, ReduceablePrice> = new Map([['', ReduceablePrice.create({ price: 0 })]]);

    /**
     * If you set this, it will be possible to choose a custom start and end date within the startDate - endDate period
     */
    @field({ decoder: IntegerDecoder })
    @field({ ...upgradePriceFrom2To4DecimalPlaces })
    pricePerDay = 0;

    getBasePrice(tagIds: string[], shouldApplyReducedPrice: boolean) {
        let result: number | null = null;

        for (const tagId of tagIds.concat([''])) {
            const price = this.prices.get(tagId);
            if (!price) continue;

            const priceForMember = price.getPrice(shouldApplyReducedPrice);

            if (result === null || priceForMember < result) {
                result = priceForMember;
            }
        }

        return result ?? 0;
    }

    calculatePrice(tagIds: string[], shouldApplyReducedPrice: boolean, days: number) {
        const basePrice = this.getBasePrice(tagIds, shouldApplyReducedPrice);
        return this.pricePerDay * days + basePrice;
    }

    get name() {
        if (this.startDate) {
            return $t(`2c3d1aac-2496-4992-ae08-327268a36a0a`) + ' ' + Formatter.date(this.startDate);
        }
        return $t(`373c7fe8-cc53-4b2d-9110-07d0fcac9738`);
    }
}

export class PlatformMembershipTypeConfig extends AutoEncoder {
    @field({ decoder: DateDecoder })
    startDate = new Date();

    @field({ decoder: DateDecoder })
    endDate = new Date();

    @field({ decoder: DateDecoder, nullable: true })
    expireDate: Date | null = null;

    @field({ decoder: IntegerDecoder })
    amountFree = 0;

    @field({ decoder: IntegerDecoder, version: 354 })
    trialDays = 0;

    @field({ decoder: new ArrayDecoder(PlatformMembershipTypeConfigPrice) })
    prices: PlatformMembershipTypeConfigPrice[] = [PlatformMembershipTypeConfigPrice.create({})];

    getPriceConfigForDate(date: Date): PlatformMembershipTypeConfigPrice {
        if (date === undefined) {
            throw new Error('Date is required');
        }
        const sorted = this.prices.slice().sort((a, b) => (a.startDate ?? new Date(0)).getTime() - (b.startDate ?? new Date(0)).getTime());
        let result = sorted[0];

        for (const priceConfig of sorted) {
            if (priceConfig.startDate === null || date >= priceConfig.startDate) {
                result = priceConfig;
            }
        }

        return result;
    }

    getPrice(date: Date, tagIds: string[], shouldApplyReducedPrice: boolean): number {
        return this.getPriceConfigForDate(date).getBasePrice(tagIds, shouldApplyReducedPrice);
    }

    get name() {
        return Formatter.dateRange(this.startDate, this.endDate);
    }
}

export enum PlatformMembershipTypeBehaviour {
    /**
     * A membership that is valid for a certain period
     */
    Period = 'Period',

    /**
     * A membership that is valid for a certain number of days
     */
    Days = 'Days',
}

export class PlatformMembershipType extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder })
    description = '';

    @field({ decoder: new EnumDecoder(PlatformMembershipTypeBehaviour) })
    behaviour = PlatformMembershipTypeBehaviour.Period;

    /**
     * Settings per period
     */
    @field({ decoder: new MapDecoder(StringDecoder, PlatformMembershipTypeConfig) })
    periods: Map<string, PlatformMembershipTypeConfig> = new Map();

    /**
     * Only allow organizations with these tags to use this membership type
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true })
    requiredTagIds: string[] | null = null;

    /**
     * Only allow groups with these default age groups to use this membership type
     */
    @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true })
    requiredDefaultAgeGroupIds: string[] | null = null;

    getPrice(periodId: string, date: Date, tagIds: string[], isReduced: boolean) {
        const period = this.periods.get(periodId);
        if (!period) {
            return null;
        }
        return period.getPrice(date, tagIds, isReduced);
    }

    isEnabled(tagIds: string[], defaultAgeGroupIds: string[]): boolean {
        return this.isEnabledForDefaultAgeGroup(defaultAgeGroupIds) && this.isEnabledForTags(tagIds);
    }

    private isEnabledForDefaultAgeGroup(defaultAgeGroupIds: string[]): boolean {
        const requiredDefaultAgeGroupIds = this.requiredDefaultAgeGroupIds;
        if (requiredDefaultAgeGroupIds === null) {
            return true;
        }

        return defaultAgeGroupIds.find(id => requiredDefaultAgeGroupIds.includes(id)) !== undefined;
    }

    private isEnabledForTags(tags: string[]): boolean {
        const requiredTags = this.requiredTagIds;
        if (requiredTags === null) {
            return true;
        }

        return tags.find(tagId => requiredTags.includes(tagId)) !== undefined;
    }
}

export class PlatformEventType extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder })
    description = '';

    /**
     * Maximum amount that each organization can have this type
     */
    @field({ decoder: IntegerDecoder, nullable: true })
    maximum: null | number = null;

    /**
     * Maximum number of days allowed for this event type
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 288 })
    maximumDays: null | number = null;

    /**
     * Minimum number of days allowed for this event type
     */
    @field({ decoder: IntegerDecoder, nullable: true, version: 288 })
    minimumDays: null | number = null;

    @field({ decoder: BooleanDecoder, version: 334 })
    isLocationRequired: boolean = false;
}

export class PlatformPolicy extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: StringDecoder })
    url = '';

    @field({ decoder: BooleanDecoder, version: 327 })
    enableAtSignup = true;

    @field({ decoder: BooleanDecoder, version: 327 })
    checkbox = true;

    @field({ decoder: RichText, version: 327 })
    richText = RichText.create({});
}

export class PrivacySettings extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(PlatformPolicy) })
    policies: PlatformPolicy[] = [];
}

export class PlatformConfig extends AutoEncoder {
    @field({ decoder: StringDecoder, version: 326 })
    name = 'Stamhoofd';

    @field({ decoder: new ArrayDecoder(StringDecoder), version: 348 })
    featureFlags: string[] = [];

    /**
     * Cotnains the text and settings for when financial support is enabled - not whether it is enabled
     */
    @field({ decoder: FinancialSupportSettings, nullable: true, version: 320 })
    financialSupport: FinancialSupportSettings | null = null;

    /**
     * Contains the text and settings for when data permissions are enabled - not whether it is enabled
     */
    @field({ decoder: DataPermissionsSettings, nullable: true, version: 320 })
    dataPermission: DataPermissionsSettings | null = null;

    @field({ decoder: OrganizationRecordsConfiguration, version: 253 })
    recordsConfiguration = OrganizationRecordsConfiguration.create({});

    @field({ decoder: OrganizationLevelRecordsConfiguration, version: 358 })
    organizationLevelRecordsConfiguration = OrganizationLevelRecordsConfiguration.create({});

    @field({ decoder: new ArrayDecoder(OrganizationTag), version: 260 })
    tags: OrganizationTag[] = [];

    @field({ decoder: new ArrayDecoder(PlatformPremiseType), version: 319 })
    premiseTypes: PlatformPremiseType[] = [];

    @field({ decoder: new ArrayDecoder(DefaultAgeGroup), version: 261 })
    defaultAgeGroups: DefaultAgeGroup[] = [];

    @field({ decoder: new ArrayDecoder(MemberResponsibility), version: 262 })
    responsibilities: MemberResponsibility[] = [];

    @field({ decoder: new ArrayDecoder(PlatformMembershipType), version: 268 })
    membershipTypes: PlatformMembershipType[] = [];

    @field({ decoder: new ArrayDecoder(PlatformEventType), version: 287 })
    eventTypes: PlatformEventType[] = [];

    @field({ decoder: new ArrayDecoder(EventNotificationType), version: 362 })
    eventNotificationTypes: EventNotificationType[] = [];

    @field({ decoder: Image, nullable: true, version: 310 })
    coverPhoto: Image | null = null;

    @field({ decoder: Image, nullable: true, version: 332 })
    coverBottomLeftOverlayImage: Image | null = null;

    @field({ decoder: NumberDecoder, version: 332 })
    coverBottomLeftOverlayWidth = 150;

    @field({ decoder: RichText, version: 332 })
    footerText = RichText.create({});

    @field({ decoder: RichText, version: 342 })
    shopFooterText = RichText.create({});

    @field({ decoder: StringDecoder, nullable: true, version: 310 })
    color: string | null = null;

    @field({ decoder: Image, nullable: true, version: 310 })
    horizontalLogoDark: Image | null = null;

    @field({ decoder: Image, nullable: true, version: 310 })
    squareLogoDark: Image | null = null;

    @field({ decoder: Image, nullable: true, version: 310 })
    horizontalLogo: Image | null = null;

    @field({ decoder: Image, nullable: true, version: 310 })
    squareLogo: Image | null = null;

    /**
     * This is not the logo of the platform, but of the corresponding organization (e.g. KSA)
     * Optional. When not set, it will use the squareLogo
     */
    @field({ decoder: Image, nullable: true, version: 384 })
    organizationLogo: Image | null = null;

    @field({ decoder: Image, nullable: true, version: 384 })
    organizationLogoDark: Image | null = null;

    @field({ decoder: Image, nullable: true, version: 348 })
    logoDocuments: Image | null = null;

    @field({ decoder: BooleanDecoder, optional: true, version: 310 })
    expandLogo = false;

    @field({ decoder: PrivacySettings, version: 327 })
    privacy = PrivacySettings.create({});

    @field({ decoder: new MapDecoder(new EnumDecoder(LoginMethod), LoginMethodConfig), version: 361 })
    loginMethods: Map<LoginMethod, LoginMethodConfig> = new Map([[
        LoginMethod.Password,
        LoginMethodConfig.create({}),
    ]]);

    getEmailReplacements(platform: { privateConfig: PlatformPrivateConfig | null }, isPreviewing = false) {
        const base = [
            Replacement.create({
                token: 'primaryColor',
                value: this.color ? this.color : '#0053ff',
            }),
            Replacement.create({
                token: 'primaryColorContrast',
                value: this.color ? Colors.getContrastColor(this.color) : '#fff',
            }),
        ];

        const fromAddress = platform.privateConfig?.emails?.find(e => e.default) || platform.privateConfig?.emails[0];

        if (fromAddress) {
            base.push(
                Replacement.create({
                    token: 'fromAddress',
                    value: fromAddress.email,
                }),
            );
            base.push(
                Replacement.create({
                    token: 'fromName',
                    value: fromAddress.name ?? this.name,
                }),
            );
        }
        else {
            base.push(
                Replacement.create({
                    token: 'fromName',
                    value: this.name,
                }),
            );
        }

        if (!isPreviewing) {
            // Add organizationName fallback
            base.push(
                Replacement.create({
                    token: 'organizationName',
                    value: this.name,
                }),
            );
        }

        base.push(
            Replacement.create({
                token: 'registerUrl',
                value: 'https://' + STAMHOOFD.domains.dashboard,
            }),
        );

        return base;
    }

    getEnabledPlatformMembershipTypes(tagIds: string[], defaultAgeGroupIds: string[]): PlatformMembershipType[] {
        return this.membershipTypes.filter(type => type.isEnabled(tagIds, defaultAgeGroupIds));
    }
}

export class Platform extends AutoEncoder {
    static instance: Platform | null = null;

    @field({ decoder: PlatformConfig })
    config: PlatformConfig = PlatformConfig.create({});

    @field({ decoder: PlatformPrivateConfig, nullable: true })
    privateConfig: PlatformPrivateConfig | null = null;

    @field({ decoder: RegistrationPeriod })
    period: RegistrationPeriod = RegistrationPeriod.create({});

    /**
     * The organization that represents the platform for collection of platform memberships payments
     */
    @field({ decoder: StringDecoder, nullable: true, version: 324 })
    membershipOrganizationId: string | null = null;

    /**
     * Keep admins accessible and in memory
     */
    admins?: User[] | null;

    /**
     * Keep admins accessible and in memory
     */
    periods?: RegistrationPeriod[];

    /**
     * If you don't have permissions, privateConfig will be null, so there won't be any roles either
     */
    getRoles() {
        return this.privateConfig?.roles ?? [];
    }

    static get shared(): Platform {
        if (!Platform.instance) {
            Platform.instance = Platform.create({});
        }
        return Platform.instance;
    }

    static get optionalShared(): Platform | null {
        return Platform.instance;
    }

    static clearShared() {
        Platform.instance = null;
    }

    setShared() {
        Platform.instance = this;
    }
}
