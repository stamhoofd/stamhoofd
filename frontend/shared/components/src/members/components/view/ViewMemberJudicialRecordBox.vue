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

            <!-- Which of the five outcomes it was: the status above collapses several of them into one. -->
            <STListItem v-if="record">
                <h3 class="style-definition-label">
                    {{ JudicialRecordHelper.getReviewDecisionName(record.reviewDecision) }}
                </h3>
                <p class="style-definition-text">
                    {{ record.reviewedAt ? $t('Beoordeeld op {date}', { date: Formatter.date(record.reviewedAt, true) }) : $t('Aangeleverd en nog niet beoordeeld') }}
                </p>
            </STListItem>
        </STList>

        <p v-if="canDeliver || canReview" class="style-button-bar">
            <button v-if="canReview" class="button primary" type="button" data-testid="judicial-record-review" @click="startReview">
                <span class="icon eye" />
                <span>{{ $t('Beoordelen') }}</span>
            </button>

            <button v-if="canDeliver" class="button primary" type="button" data-testid="judicial-record-upload" @click="startDelivery">
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
import { Formatter } from '@stamhoofd/utility';
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

const isConfigured = computed(() => JudicialRecordHelper.asksForExtract({ platform: platform.value, organization: organization.value }));

const judicialRecord = computed(() => props.member.judicialRecord);
const record = computed(() => props.member.patchedMember.judicialRecord);

const canDeliver = computed(() => {
    return judicialRecord.value.status === JudicialRecordStatus.Required
        && auth.canAccessPlatformMember(props.member, PermissionLevel.Full);
});

/**
 * Offered on the document rather than on the status: the retention window removes the document from a record
 * nobody got to, which leaves it waiting for a review that can no longer be carried out.
 */
const canReview = computed(() => {
    return record.value?.hasDocument === true && auth.hasPlatformFullAccess();
});

async function startReview() {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('#judicial-record/JudicialRecordReviewView.vue'), {
                    member: props.member,
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

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
