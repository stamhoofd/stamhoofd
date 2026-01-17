import { ArrayDecoder, AutoEncoder, BooleanDecoder, Decoder, field, IntegerDecoder, MapDecoder, StringDecoder } from '@simonbackx/simple-encoding';

import { PropertyFilter } from '../filters/PropertyFilter.js';
import { type Group } from '../Group.js';
import { GroupType } from '../GroupType.js';
import { Organization } from '../Organization.js';
import { Platform } from '../Platform.js';
import { RecordCategory } from './records/RecordCategory.js';

export enum AskRequirement {
    NotAsked = 'NotAsked',
    Optional = 'Optional',
    Required = 'Required',
}

export class FreeContributionSettings extends AutoEncoder {
    @field({ decoder: StringDecoder })
    description = '';

    @field({ decoder: new ArrayDecoder(IntegerDecoder) })
    @field({
        decoder: new ArrayDecoder(IntegerDecoder),
        upgrade: (oldValue: number[]) => {
            if (!Array.isArray(oldValue)) {
                return oldValue;
            }
            return oldValue.map(o => o * 100);
        },
        downgrade: (newValue: number[]) => {
            if (!Array.isArray(newValue)) {
                return newValue;
            }
            return newValue.map(o => Math.round(o / 100));
        },
        version: 389,
    })
    amounts: number[] = [5_0000, 15_0000, 30_0000];
}

export class FinancialSupportSettings extends AutoEncoder {
    /**
     * E.g. 'financial support'
     */
    @field({ decoder: StringDecoder })
    title = FinancialSupportSettings.defaultTitle;

    /**
     * E.g. 'We provide financial support for families in financial difficulties. You can ask for this by checking this checkbox'
     */
    @field({ decoder: StringDecoder })
    description = FinancialSupportSettings.defaultDescription;

    /**
     * E.g. 'My family is in need of financial support'
     */
    @field({ decoder: StringDecoder })
    checkboxLabel = FinancialSupportSettings.defaultCheckboxLabel;

    /**
     * E.g. 'SOMkort'
    */
    @field({ decoder: StringDecoder, version: 289 })
    priceName = FinancialSupportSettings.defaultPriceName;

    /**
     * E.g. 'Uses financial support'
     */
    @field({ decoder: StringDecoder, optional: true })
    warningText = FinancialSupportSettings.defaultWarningText;

    /**
     * Whether a member can self assign financial support.
     * If false a member who chooses financial support cannot self subscribe.
     */
    @field({ decoder: BooleanDecoder, optional: true, version: 319 })
    preventSelfAssignment = false;

    /**
     * The text that a member sees if he cannot inscribe with financial support.
     */
    @field({ decoder: StringDecoder, nullable: true, version: 319 })
    preventSelfAssignmentText: string | null = null;

    // todo translations
    static get defaultDescription() {
        return `We doen ons best om de kostprijs van onze activiteiten zo laag mogelijk te houden. Daarnaast voorzien we middelen om gezinnen die dat nodig hebben te ondersteunen. Om de drempel zo laag mogelijk te houden, voorzien we een discrete checkbox waarmee je kan aangeven dat je ondersteuning nodig hebt. We gaan hier uiterst discreet mee om.`;
    }

    // todo translations
    static get defaultTitle() {
        return `Financiële ondersteuning`;
    }

    // todo translations
    static get defaultPriceName() {
        return `Verlaagd tarief`;
    }

    // todo translations
    static get defaultCheckboxLabel() {
        return `Mijn gezin heeft nood aan financiële ondersteuning en ik wil dit discreet kenbaar maken`;
    }

    // todo translations
    static get defaultWarningText() {
        return `Gebruikt financiële ondersteuning`;
    }

    // todo translations
    static get defaultPreventSelfAssignmentText() {
        return `Er is goedkeuring nodig om in te schrijven met financiële ondersteuning. Gelieve de groep te contacteren.`;
    }
}

export class DataPermissionsSettings extends AutoEncoder {
    /**
     * E.g. 'financial support'
     */
    @field({ decoder: StringDecoder })
    title = DataPermissionsSettings.defaultTitle;

    /**
     * E.g. 'We provide financial support for families in financial difficulties. You can ask for this by checking this checkbox'
     */
    @field({ decoder: StringDecoder })
    description = DataPermissionsSettings.defaultDescription;

    /**
     * E.g. 'My family is in need of financial support'
     */
    @field({ decoder: StringDecoder })
    checkboxLabel = DataPermissionsSettings.defaultCheckboxLabel;

    /**
     * Warning that is shown if the checkbox is not checked
     * E.g. 'Without this information the group will not be able to offer a reduced price if you are eligible for financial support.'
     */
    @field({ decoder: StringDecoder, nullable: true, version: 333 })
    checkboxWarning: string | null = null;

    /**
     * Warning for administrators
     * E.g. 'Uses financial support'
     */
    @field({ decoder: StringDecoder, optional: true })
    warningText = DataPermissionsSettings.defaultWarningText;

    static get defaultDescription() {
        return '';
    }

    static get defaultTitle() {
        return $t(`75398f88-8d64-47e9-8d8f-627af69052db`);
    }

    static get defaultCheckboxLabel() {
        return $t(`b3c24a8b-6dbd-43c5-927e-34d362b30bbe`);
    }

    static get defaultWarningText() {
        return $t(`197cf20f-2759-45a0-a7ea-016ab11a6f10`);
    }

    static get defaultCheckboxWarning() {
        return '';
    }
}

export class OrganizationRecordsConfiguration extends AutoEncoder {
    // New record configurations

    /**
     * If the organizations provides support for families in financial difficulties
     */
    @field({ decoder: FinancialSupportSettings, nullable: true, version: 117 })
    @field({
        decoder: BooleanDecoder,
        version: 320,
        upgrade: (old: any) => {
            return !!old;
        },
    })
    financialSupport = false;

    /**
     * Ask permissions to collect data
     */
    @field({ decoder: DataPermissionsSettings, nullable: true, version: 117 })
    @field({
        decoder: BooleanDecoder,
        version: 320,
        upgrade: (old: any) => {
            return !!old;
        },
    })
    dataPermission = false;

    @field({ decoder: PropertyFilter, nullable: true, version: 124 })
    emailAddress: PropertyFilter | null = null;

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    phone: PropertyFilter | null = null;

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    gender: PropertyFilter | null = null;

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    birthDay: PropertyFilter | null = null;

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    address: PropertyFilter | null = null;

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    parents: PropertyFilter | null = null;

    @field({ decoder: PropertyFilter, nullable: true, version: 125 })
    emergencyContacts: PropertyFilter | null = null;

    @field({ decoder: PropertyFilter, nullable: true, version: 306 })
    uitpasNumber: PropertyFilter | null = null;

    @field({ decoder: PropertyFilter, nullable: true, version: 348 })
    nationalRegisterNumber: PropertyFilter | null = null;

    @field({ decoder: new ArrayDecoder(RecordCategory as Decoder<RecordCategory>), version: 117 })
    recordCategories: RecordCategory[] = [];

    /**
     * Defines if optional record categories in the parent are enabled, and when they are enabled (using a filter)
     */
    @field({ decoder: new MapDecoder(StringDecoder, PropertyFilter), version: 254 })
    inheritedRecordCategories: Map<string, PropertyFilter> = new Map();

    // General configurations
    @field({ decoder: FreeContributionSettings, nullable: true, version: 92 })
    freeContribution: FreeContributionSettings | null = null;

    static build(options: {
        platform: Platform;
        organization?: Organization | null;
        group?: Group | null;

        /**
         * When configuring default age groups, this has to be set to true so the platform record categories
         * that are enabled by default for default age groups, are not disabled
         */
        forceDefaultAgeGroup?: boolean;

        /**
         * Whether the group itself should be included
         */
        includeGroup?: boolean;
    }) {
        // If not a default-age-group: disable enabled record categories in platform
        const platformConfig = options.platform.config.recordsConfiguration.clone();
        if ((!options.group || !options.group.defaultAgeGroupId) && !options.forceDefaultAgeGroup) {
            for (const c of platformConfig.recordCategories) {
                c.defaultEnabled = false;
            }
        }

        let organizationConfig: OrganizationRecordsConfiguration | null = null;
        let defaultGroupConfig: OrganizationRecordsConfiguration | null = null;
        let groupConfig: OrganizationRecordsConfiguration | null = null;

        if (options.organization) {
            organizationConfig = options.organization.meta.recordsConfiguration.clone();

            if (options.group && options.group.type !== GroupType.Membership) {
                // Specifically delete all the record categories, as those are only enabled for normal memberships
                for (const c of organizationConfig.recordCategories) {
                    c.defaultEnabled = false;
                }
            }

            if (options.group && options.group.type === GroupType.WaitingList) {
                // All fields are disabled by default, but can be enabled in the settings of the group
                // We still keep all the record categories (defaultEnabled already has been set to false)
                // so they can be enabled again in the group
                organizationConfig = OrganizationRecordsConfiguration.create({
                    recordCategories: organizationConfig.recordCategories,
                });
            }
        }

        // Group config
        if (options.group && options.includeGroup) {
            groupConfig = options.group.settings.recordsConfiguration.clone();
        }

        if (options.group && options.group?.defaultAgeGroupId) {
            const defaultAgeGroupId = options.group.defaultAgeGroupId;
            defaultGroupConfig = options.platform.config.defaultAgeGroups.find(g => g.id === defaultAgeGroupId)?.recordsConfiguration.clone() ?? null;
        }

        return this.mergeChildren(...([platformConfig, defaultGroupConfig, organizationConfig, groupConfig].filter(f => f !== null)));
    }

    static mergeChildren(...configs: OrganizationRecordsConfiguration[]): OrganizationRecordsConfiguration {
        if (configs.length === 0) {
            throw new Error('At least one configuration is required');
        }

        if (configs.length === 1) {
            return configs[0];
        }

        const first = configs[0];
        const second = configs[1];

        return this.mergeChildren(this.mergeChild(first, second), ...configs.slice(2));
    }

    /**
     * Note: best to not use this visually
     */
    static mergeChild(parent: OrganizationRecordsConfiguration, child: OrganizationRecordsConfiguration): OrganizationRecordsConfiguration {
        const clone = child.clone();

        if (parent.financialSupport !== false) {
            clone.financialSupport = parent.financialSupport;
        }

        if (parent.dataPermission !== false) {
            clone.dataPermission = parent.dataPermission;
        }

        if (parent.uitpasNumber !== null) {
            if (clone.uitpasNumber) {
                clone.uitpasNumber = clone.uitpasNumber.merge(parent.uitpasNumber);
            }
            else {
                clone.uitpasNumber = parent.uitpasNumber;
            }
        }

        if (parent.nationalRegisterNumber !== null) {
            if (clone.nationalRegisterNumber) {
                clone.nationalRegisterNumber = clone.nationalRegisterNumber.merge(parent.nationalRegisterNumber);
            }
            else {
                clone.nationalRegisterNumber = parent.nationalRegisterNumber;
            }
        }

        if (parent.emailAddress !== null) {
            if (clone.emailAddress) {
                clone.emailAddress = clone.emailAddress.merge(parent.emailAddress);
            }
            else {
                clone.emailAddress = parent.emailAddress;
            }
        }

        if (parent.phone !== null) {
            if (clone.phone) {
                clone.phone = clone.phone.merge(parent.phone);
            }
            else {
                clone.phone = parent.phone;
            }
        }

        if (parent.gender !== null) {
            if (clone.gender) {
                clone.gender = clone.gender.merge(parent.gender);
            }
            else {
                clone.gender = parent.gender;
            }
        }

        if (parent.birthDay !== null) {
            if (clone.birthDay) {
                clone.birthDay = clone.birthDay.merge(parent.birthDay);
            }
            else {
                clone.birthDay = parent.birthDay;
            }
        }

        if (parent.address !== null) {
            if (clone.address) {
                clone.address = clone.address.merge(parent.address);
            }
            else {
                clone.address = parent.address;
            }
        }

        if (parent.parents !== null) {
            if (clone.parents) {
                clone.parents = clone.parents.merge(parent.parents);
            }
            else {
                clone.parents = parent.parents;
            }
        }

        if (parent.emergencyContacts !== null) {
            if (clone.emergencyContacts) {
                clone.emergencyContacts = clone.emergencyContacts.merge(parent.emergencyContacts);
            }
            else {
                clone.emergencyContacts = parent.emergencyContacts;
            }
        }

        if (parent.freeContribution !== null) {
            clone.freeContribution = parent.freeContribution;
        }

        clone.recordCategories = [...parent.recordCategories.map((r) => {
            const c = r.clone();
            if (r.defaultEnabled) {
                return c;
            }
            const inheritedFilter = child.inheritedRecordCategories.get(r.id);
            if (inheritedFilter !== undefined) {
                c.filter = inheritedFilter;
                c.defaultEnabled = true;
            }

            return c;
        }), ...clone.recordCategories];

        // Nothing inherited yet
        clone.inheritedRecordCategories = new Map();

        return clone;
    }
}
