import type { PatchableArray } from '@simonbackx/simple-encoding';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { Organization, Platform, RecordCategory, RecordSettings } from '@stamhoofd/structures';
import { RecordType } from '@stamhoofd/structures';
import type { MailchimpSettings } from '@stamhoofd/structures/mailchimp/MailchimpSettings.js';
import { computed } from 'vue';
import { useContext } from '#hooks/useContext.ts';
import { manualFeatureFlag } from '#hooks/useFeatureFlag.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';

/**
 * Without an organization, the platform connection is used (admin app)
 */
export function getMailchimpSettings(organization: Organization | null, platform: Platform): MailchimpSettings | null {
    if (organization) {
        return organization.privateMeta?.mailchimp ?? null;
    }
    return platform.privateConfig?.mailchimp ?? null;
}

export function canUseMailchimp(context: SessionContext, platform: Platform, organization: Organization | null) {
    if (!manualFeatureFlag('mailchimp', context, platform, organization)) {
        return false;
    }
    return organization ? context.auth.hasFullAccess() : context.auth.hasPlatformFullAccess();
}

/**
 * Whether the synchronise actions can be shown
 */
export function isMailchimpReady(context: SessionContext, platform: Platform, organization: Organization | null) {
    return canUseMailchimp(context, platform, organization) && !!getMailchimpSettings(organization, platform)?.audienceId;
}

export function useMailchimpSettings() {
    const organization = useOrganization();
    const platform = usePlatform();
    const context = useContext();

    const settings = computed(() => getMailchimpSettings(organization.value, platform.value));

    function setSettings(value: MailchimpSettings | null) {
        if (organization.value) {
            if (organization.value.privateMeta) {
                organization.value.privateMeta.mailchimp = value;
            }
            return;
        }
        if (platform.value.privateConfig) {
            platform.value.privateConfig.mailchimp = value;
        }
    }

    return {
        settings,
        setSettings,
        isPlatform: computed(() => !organization.value),
        isReady: computed(() => isMailchimpReady(context.value, platform.value, organization.value)),
    };
}

export const mailchimpRecordTypes = [RecordType.Checkbox, RecordType.ChooseOne, RecordType.MultipleChoice];

export type MailchimpRecordGroup = {
    title: string;
    records: RecordSettings[];
};

function getRecords(categories: RecordCategory[]) {
    return categories.flatMap(c => c.getAllRecords()).filter(r => mailchimpRecordTypes.includes(r.type));
}

/**
 * Records that can be used for consent or tags, grouped by where they are defined.
 * A platform can only use its own records: records of organizations have no shared meaning.
 */
export function getMailchimpRecordGroups(organization: Organization | null, platform: Platform): MailchimpRecordGroup[] {
    const groups: MailchimpRecordGroup[] = [
        { title: $t('%Zuf', { platform: platform.config.name }), records: getRecords(platform.config.recordsConfiguration.recordCategories) },
    ];

    if (organization) {
        groups.push({ title: $t('%ZxC', { organization: organization.name }), records: getRecords(organization.meta.recordsConfiguration.recordCategories) });

        for (const group of organization.period.groups) {
            groups.push({ title: $t('%ZvB', { group: group.settings.name.toString() }), records: getRecords(group.settings.recordCategories) });
        }
    }
    else {
        for (const ageGroup of platform.config.defaultAgeGroups) {
            groups.push({ title: $t('%Zua', { group: ageGroup.name }), records: getRecords(ageGroup.recordsConfiguration.recordCategories) });
        }
    }

    // The same record can be inherited in multiple places
    const seen = new Set<string>();
    for (const group of groups) {
        group.records = group.records.filter((r) => {
            if (seen.has(r.id)) {
                return false;
            }
            seen.add(r.id);
            return true;
        });
    }

    return groups.filter(g => g.records.length > 0);
}

/**
 * Turns the difference between two id lists into puts and deletes on an array patch
 */
export function replaceIds(patch: PatchableArray<string, string, string>, current: string[], selected: string[]) {
    for (const id of current) {
        if (!selected.includes(id)) {
            patch.addDelete(id);
        }
    }
    for (const id of selected) {
        if (!current.includes(id)) {
            patch.addPut(id);
        }
    }
}

export function getRecordTypeName(type: RecordType) {
    switch (type) {
        case RecordType.Checkbox: return $t('%115');
        case RecordType.ChooseOne: return $t('%Zwd');
        case RecordType.MultipleChoice: return $t('%TI');
        default: return '';
    }
}
