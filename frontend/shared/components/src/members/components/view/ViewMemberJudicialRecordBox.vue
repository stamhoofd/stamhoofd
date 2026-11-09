<template>
    <div v-if="isConfigured" class="container">
        <hr><h2>{{ $t('Uittreksel uit het strafregister') }}</h2>

        <STList>
            <STListItem>
                <h3 class="style-definition-label">
                    {{ JudicialRecordHelper.getStatusName(judicialRecord.status) }}
                </h3>
                <p class="style-definition-text">
                    {{ judicialRecord.description }}
                </p>
            </STListItem>
        </STList>

        <p v-if="canDeliver" class="style-button-bar">
            <button class="button primary" type="button" data-testid="judicial-record-upload" @click="startDelivery">
                <span class="icon upload" />
                <span>{{ $t('Uploaden voor {name}', { name: member.patchedMember.firstName }) }}</span>
            </button>
        </p>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController, usePresent } from '@browser/navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { useAuth } from '#hooks/useAuth.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { judicialRecordDeliveryFlowFirstStep } from '#judicial-record/judicialRecordDeliveryFlow.ts';
import type { PlatformMember } from '@stamhoofd/structures';
import { JudicialRecordHelper, JudicialRecordStatus } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { computed } from 'vue';

defineOptions({
    inheritAttrs: false,
});

const props = defineProps<{
    member: PlatformMember;
}>();

const platform = usePlatform();
const organization = useOrganization();
const auth = useAuth();
const present = usePresent();

/** Without a single responsibility asking for an extract, the whole question is irrelevant for this organization. */
const isConfigured = computed(() => {
    return [
        ...platform.value.config.responsibilities,
        ...(organization.value?.privateMeta?.responsibilities ?? []),
    ].some(r => r.judicialRecordMinimumAge !== null);
});

const judicialRecord = computed(() => props.member.judicialRecord);

const canDeliver = computed(() => {
    return judicialRecord.value.status === JudicialRecordStatus.Required
        && auth.canAccessPlatformMember(props.member, PermissionLevel.Full);
});

/**
 * The same three steps as in the member portal, but presented as a popup on top of the member
 * detail rather than pushed onto a tab: the detail is itself a popup, so pushing would bury it.
 */
async function startDelivery() {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(
                    judicialRecordDeliveryFlowFirstStep.component,
                    judicialRecordDeliveryFlowFirstStep.props({
                        member: props.member,
                        onBehalfOfMember: true,
                        dismissHandler: async navigate => await navigate.dismiss({ force: true }),
                    }),
                ),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}
</script>
