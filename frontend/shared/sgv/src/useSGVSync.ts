import { defineRoute, useNavigate } from '@simonbackx/vue-app-navigation';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import type {
    MemberWithRegistrationsBlob,
    Organization,
} from '@stamhoofd/structures';
import {
    SGVSyncStatus,
} from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { computed, toValue } from 'vue';
import { isMemberManaged } from './SGVSyncReport.ts';

enum Routes {
    SGV = 'sgv',
}

export type SGVSyncWarning = {
    status:
        | SGVSyncStatus.Never
        | SGVSyncStatus.Outdated
        | SGVSyncStatus.Changed;
    text: string;
};

export type UseSGVSyncReturn = {
    /** Opens the SGV group administration sync popup when SGV sync is enabled. */
    sgvSyncOpen: () => Promise<void>;

    /** Warning for the passed members, or null when there are no members or no sync action is needed. */
    sgvSyncWarning: ComputedRef<SGVSyncWarning | null>;

    /** True when the current organization is an SGV youth organization and the user can sync it. */
    sgvSyncIsEnabled: ComputedRef<boolean>;
};

/**
 * Provides the shared SGV sync state and popup opener for the current organization.
 * Pass members when a list should show the aggregated SGV sync warning; otherwise the warning stays null.
 */
export function useSGVSync(
    members?: MaybeRefOrGetter<MemberWithRegistrationsBlob[]>,
    organizationOverride?: MaybeRefOrGetter<Organization | null | undefined>,
): UseSGVSyncReturn {
    const navigate = useNavigate();
    const auth = useAuth();
    const organizationScope = useOrganization();
    const organization = computed(() => organizationOverride ? toValue(organizationOverride) : organizationScope.value);
    const sgvSyncIsEnabled = computed(() => auth.hasFullAccess() && !!organization.value?.isSGVSyncOrganization);

    defineRoute({
        url: Routes.SGV,
        name: Routes.SGV,
        show: 'detail',
        present: 'popup',
        component: async () => (await import('./components/SGVGroupAdministrationView.vue')).default,
        defaultProperties: query => ({
            code: query?.get('code') ?? undefined,
            state: query?.get('state') ?? undefined,
        }),
        propsToParams: props => ({
            query: props.code && props.state
                ? new URLSearchParams([
                    ['code', props.code],
                    ['state', props.state],
                ])
                : null,
        }),
    });

    async function sgvSyncOpen(): Promise<void> {
        if (!sgvSyncIsEnabled.value) {
            return;
        }

        await navigate(Routes.SGV);
    }

    const sgvSyncWarning = computed(() => getSGVSyncWarning(
        members ? toValue(members) : null,
        organization.value,
        auth.hasFullAccess(),
    ));

    return {
        sgvSyncOpen,
        sgvSyncWarning,
        sgvSyncIsEnabled,
    };
}

/**
 * Builds the member-list SGV warning for SGV organizations by summarizing active SGV-managed members.
 * Returns null when no members were passed, the organization is not an SGV organization, or all members are synced.
 * */
export function getSGVSyncWarning(
    members: MemberWithRegistrationsBlob[] | null,
    organization: Organization | null | undefined,
    hasFullAccess: boolean,
): SGVSyncWarning | null {
    if (!members || !organization || !organization.isSGVSyncOrganization) {
        return null;
    }

    const counts = {
        [SGVSyncStatus.Never]: 0,
        [SGVSyncStatus.Outdated]: 0,
        [SGVSyncStatus.Changed]: 0,
    };

    for (const member of members) {
        if (!isMemberManaged(member, organization)) {
            continue;
        }

        const status = member.getSGVSyncStatus({
            periodId: organization.period.period.id,
        });
        if (
            status === SGVSyncStatus.Never
            || status === SGVSyncStatus.Outdated
            || status === SGVSyncStatus.Changed
        ) {
            counts[status] += 1;
        }
    }

    const texts: string[] = [];
    if (counts[SGVSyncStatus.Never] > 0) {
        texts.push(
            Formatter.capitalizeFirstLetter(
                Formatter.pluralText(
                    counts[SGVSyncStatus.Never],
                    $t('%1cS'),
                    $t('%1Vs'),
                ),
            )
            + ' '
            + $t(
                'nog niet in de groepsadministratie van Scouts en Gidsen Vlaanderen. Deze leden zijn mogelijk niet verzekerd.',
            ),
        );
    }
    if (counts[SGVSyncStatus.Outdated] > 0) {
        texts.push(
            Formatter.capitalizeFirstLetter(
                Formatter.pluralText(
                    counts[SGVSyncStatus.Outdated],
                    $t('%1ar'),
                    $t('%1Vj'),
                ),
            ) + '.',
        );
    }
    if (counts[SGVSyncStatus.Changed] > 0) {
        texts.push(
            Formatter.capitalizeFirstLetter(
                Formatter.pluralText(
                    counts[SGVSyncStatus.Changed],
                    $t('%1Xt'),
                    $t('%1aP'),
                ),
            ) + '.',
        );
    }

    if (texts.length === 0) {
        return null;
    }

    texts.push(
        hasFullAccess
            ? $t('%1Z6')
            : $t('%1b9'),
    );

    return {
        status:
            counts[SGVSyncStatus.Never] > 0
                ? SGVSyncStatus.Never
                : counts[SGVSyncStatus.Outdated] > 0
                    ? SGVSyncStatus.Outdated
                    : SGVSyncStatus.Changed,
        text: texts.join(' '),
    };
}
