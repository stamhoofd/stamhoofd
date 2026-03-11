<template>
    <LoadingViewTransition>
        <div v-if="!loadingPayingOrganization" class="st-view">
            <STNavigationBar :title="title">
                <template #right>
                    <button v-if="hasPrevious || hasNext" v-tooltip="$t('%hg')" type="button" class="button icon arrow-up" :disabled="!hasPrevious" @click="goBack" />
                    <button v-if="hasNext || hasPrevious" v-tooltip="$t('%hh')" type="button" class="button icon arrow-down" :disabled="!hasNext" @click="goForward" />
                </template>
            </STNavigationBar>

            <main>
                <h1 class="style-navigation-title">
                    {{ title }}
                </h1>
                <p v-if="item.objectType === ReceivableBalanceType.member || item.objectType === ReceivableBalanceType.user">
                    {{ $t("%hf") }}
                </p>

                <p v-if="item.objectType === ReceivableBalanceType.userWithoutMembers" class="info-box">
                    {{ $t("%1HP") }}
                </p>

                <STList class="info">
                    <STListItem v-if="payingOrganization" :selectable="canClick" @click="onClick">
                        <h3 class="style-definition-label">
                            {{ capitalizeFirstLetter(getReceivableBalanceTypeName(item.objectType)) }}
                        </h3>
                        <p v-copyable class="style-definition-text style-copyable">
                            {{ payingOrganization.name }}
                        </p>

                        <p v-if="(item.objectType === ReceivableBalanceType.userWithoutMembers || item.objectType === ReceivableBalanceType.user) && item.object.contacts.length === 1 && item.object.contacts[0].emails.length === 1" v-copyable class="style-description-small style-copyable">
                            {{ item.object.contacts[0].emails[0] }}
                        </p>

                        <p v-if="payingOrganization.uri" v-copyable class="style-description-small style-copyable">
                            {{ payingOrganization.uri }}
                        </p>

                        <p v-if="payingOrganization.address" v-copyable class="style-description-small style-copyable">
                            {{ payingOrganization.address }}
                        </p>

                        <template #right>
                            <OrganizationAvatar :organization="payingOrganization" />
                        </template>
                    </STListItem>

                    <STListItem v-else :selectable="canClick" @click="onClick">
                        <h3 class="style-definition-label">
                            {{ capitalizeFirstLetter(getReceivableBalanceTypeName(item.objectType)) }}
                        </h3>
                        <p v-copyable class="style-definition-text style-copyable">
                            {{ item.object.name }}
                        </p>

                        <p v-if="(item.objectType === ReceivableBalanceType.userWithoutMembers || item.objectType === ReceivableBalanceType.user) && item.object.contacts.length === 1 && item.object.contacts[0].emails.length === 1" v-copyable class="style-description-small style-copyable">
                            {{ item.object.contacts[0].emails[0] }}
                        </p>

                        <p v-if="item.object.uri" v-copyable class="style-description-small style-copyable">
                            {{ item.object.uri }}
                        </p>

                        <template v-if="canClick" #right>
                            <span class="icon user gray" />
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem v-if="item.amountOpen >= 0">
                        <h3 class="style-definition-label">
                            {{ $t('%76') }}
                        </h3>
                        <p class="style-definition-text">
                            {{ formatPrice(item.amountOpen + Math.max(0, item.amountPending)) }}
                        </p>
                        <p v-if="item.amountPending > 0" class="style-description-small">
                            {{ $t('%hi', {amount: formatPrice(item.amountPending)}) }}
                        </p>
                        <p v-if="item.amountPending < 0" class="style-description-small">
                            {{ $t('%hj', {amount: formatPrice(-item.amountPending)}) }}
                        </p>
                    </STListItem>

                    <STListItem v-else>
                        <h3 class="style-definition-label">
                            {{ $t('%10b') }}
                        </h3>
                        <p class="style-definition-text error">
                            {{ formatPrice(-item.amountOpen + Math.max(0, -item.amountPending)) }}
                        </p>
                        <p v-if="item.amountPending > 0" class="style-description-small">
                            {{ $t('%hk', {amount: formatPrice(item.amountPending)}) }}
                        </p><p v-if="item.amountPending < 0" class="style-description-small">
                            {{ $t('%hl', {amount: formatPrice(-item.amountPending)}) }}
                        </p>
                    </STListItem>

                    <STListItem v-if="item.amountOpen > 0 && (item.objectType === ReceivableBalanceType.organization || item.objectType === ReceivableBalanceType.user)">
                        <h3 class="style-definition-label">
                            {{ $t('%88') }}
                        </h3>
                        <p class="style-definition-text">
                            {{ item.lastReminderEmail && item.reminderEmailCount > 0 ? formatDateTime(item.lastReminderEmail, true) : $t('%hm') }}
                        </p>
                        <p v-if="item.lastReminderEmail && item.reminderEmailCount > 1" class="style-description-small">
                            {{ $t('%hn', {count: item.reminderEmailCount.toString()}) }}
                        </p>
                        <p v-if="item.lastReminderEmail && item.reminderEmailCount && item.lastReminderAmountOpen !== item.amountOpen" class="style-description-small">
                            {{ $t('%ho', {amount: formatPrice(item.lastReminderAmountOpen)}) }}
                        </p>
                        <p v-if="!item.lastReminderEmail || item.reminderEmailCount === 0" class="style-description-small">
                            {{ $t('%hp') }}
                        </p>
                    </STListItem>
                </STList>

                <hr><ReceivableBalanceBox :item="item" :member="member" :hide-segmented-control="item.objectType !== ReceivableBalanceType.organization" :paying-organization="payingOrganization" />
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { MemberSegmentedView, PromiseView, Toast, useBackForward, useExternalOrganization, useMembersObjectFetcher, LoadingViewTransition, OrganizationLogo, OrganizationAvatar } from '@stamhoofd/components';
import { getReceivableBalanceTypeName, LimitedFilteredRequest, PlatformMember, ReceivableBalance, ReceivableBalanceType } from '@stamhoofd/structures';
import { computed } from 'vue';
import ReceivableBalanceBox from './ReceivableBalanceBox.vue';

const props = withDefaults(
    defineProps<{
        item: ReceivableBalance;
        getNext: (current: ReceivableBalance) => ReceivableBalance | null;
        getPrevious: (current: ReceivableBalance) => ReceivableBalance | null;
        member?: PlatformMember | null;
    }>(),
    {
        member: null,
    });

const { goBack, goForward, hasNext, hasPrevious } = useBackForward('item', props);
const present = usePresent();
const memberFetcher = useMembersObjectFetcher();
const payingOrganizationId = computed(() => {
    return props.item.objectType === ReceivableBalanceType.organization ? props.item.object.id : null;
});
const { externalOrganization: payingOrganization, loading: loadingPayingOrganization } = useExternalOrganization(payingOrganizationId);

const title = computed(() => {
    return $t('%76');
});

const canClick = computed(() => {
    return props.item.objectType === ReceivableBalanceType.member;
});

async function onClick() {
    if (props.item.objectType === ReceivableBalanceType.member) {
        await showMember(props.item.object.id);
    }
}

async function showMember(memberId: string) {
    const component = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(PromiseView, {
            promise: async () => {
                const members = await memberFetcher.fetch(new LimitedFilteredRequest({
                    filter: {
                        id: memberId,
                    },
                    limit: 1,
                }));
                if (members.results.length === 0) {
                    Toast.error($t(`%yX`)).show();
                    throw new Error('Member not found');
                }
                return new ComponentWithProperties(MemberSegmentedView, {
                    member: members.results[0],
                });
            },
        }),
    });

    await present({
        components: [component],
        modalDisplayStyle: 'popup',
    });
}

</script>
