<template>
    <div class="member-payments-view">
        <main class="container">
            <p v-if="member.patchedMember.details.hasFinancialSupportOrActiveUitpas" class="info-box">
                {{ financialSupportWarningText }}
            </p>

            <ReceivableBalanceBox :item="tmpItem" :member="member" />
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ReceivableBalanceBox, useAuth, useFinancialSupportSettings, useOrganization } from '@stamhoofd/components';
import { PermissionLevel, PlatformMember, ReceivableBalance, ReceivableBalanceObject, ReceivableBalanceType } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    member: PlatformMember;
}>();

const organization = useOrganization();

const tmpItem = ReceivableBalance.create({
    organizationId: organization.value!.id,
    objectType: ReceivableBalanceType.member,
    object: ReceivableBalanceObject.create({
        id: props.member.id,
    }),
});
const auth = useAuth();
const { financialSupportSettings } = useFinancialSupportSettings();

const financialSupportWarningText = computed(() => {
    return financialSupportSettings.value.warningText;
});

const hasWrite = computed(() => {
    return auth.canAccessMemberPayments(props.member, PermissionLevel.Write);
});

</script>
