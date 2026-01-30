<template>
    <LoadingViewTransition>
        <div v-if="!loadingPayingOrganization" class="st-view">
            <STNavigationBar :title="title">
                <template #right>
                    <button v-if="hasPrevious || hasNext" v-tooltip="$t('1dd3e934-a69f-4a24-ba03-b945162e4c38')" type="button" class="button icon arrow-up" :disabled="!hasPrevious" @click="goBack" />
                    <button v-if="hasNext || hasPrevious" v-tooltip="$t('9b500fcb-d4a2-4147-8422-c474a1297b5f')" type="button" class="button icon arrow-down" :disabled="!hasNext" @click="goForward" />
                </template>
            </STNavigationBar>

            <main>
                <h1 class="style-navigation-title">
                    {{ title }}
                </h1>
                <p v-if="item.objectType === ReceivableBalanceType.member || item.objectType === ReceivableBalanceType.user">
                    {{ $t("0d7ce596-ad47-490d-b619-0cb1f1ae84ec") }}
                </p>

                <p v-if="item.objectType === ReceivableBalanceType.userWithoutMembers" class="info-box">
                    {{ $t("5d5aa495-fe78-45f5-93b2-4c78acdc1e9f") }}
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
                            {{ $t('28c2bc66-231f-44f3-9249-c1981b871a1f') }}
                        </h3>
                        <p class="style-definition-text">
                            {{ formatPrice(item.amountOpen + Math.max(0, item.amountPending)) }}
                        </p>
                        <p v-if="item.amountPending > 0" class="style-description-small">
                            {{ $t('e6792924-6216-455e-9bfc-a555c716311f', {amount: formatPrice(item.amountPending)}) }}
                        </p>
                        <p v-if="item.amountPending < 0" class="style-description-small">
                            {{ $t('30fe0a04-5f5a-4d0e-84a3-17a7d4bb49e0', {amount: formatPrice(-item.amountPending)}) }}
                        </p>
                    </STListItem>

                    <STListItem v-else>
                        <h3 class="style-definition-label">
                            {{ $t('d9ba4476-8dbe-46d5-bad9-e49c062cbfa1') }}
                        </h3>
                        <p class="style-definition-text error">
                            {{ formatPrice(-item.amountOpen + Math.max(0, -item.amountPending)) }}
                        </p>
                        <p v-if="item.amountPending > 0" class="style-description-small">
                            {{ $t('5ba25f05-aba1-474d-83fe-3a7e25d7fa13', {amount: formatPrice(item.amountPending)}) }}
                        </p><p v-if="item.amountPending < 0" class="style-description-small">
                            {{ $t('7ce2a53b-e6ab-415a-a683-6daf1ae76897', {amount: formatPrice(-item.amountPending)}) }}
                        </p>
                    </STListItem>

                    <STListItem v-if="item.amountOpen > 0 && (item.objectType === ReceivableBalanceType.organization || item.objectType === ReceivableBalanceType.user)">
                        <h3 class="style-definition-label">
                            {{ $t('a8bf2d7d-3208-4c18-bac3-2cc97b629ad1') }}
                        </h3>
                        <p class="style-definition-text">
                            {{ item.lastReminderEmail && item.reminderEmailCount > 0 ? formatDateTime(item.lastReminderEmail, true) : $t('5cfae96d-516c-4b37-9ddf-afd21cab6574') }}
                        </p>
                        <p v-if="item.lastReminderEmail && item.reminderEmailCount > 1" class="style-description-small">
                            {{ $t('d2d006f9-8a7d-419b-9fa6-432a9e86bef7', {count: item.reminderEmailCount.toString()}) }}
                        </p>
                        <p v-if="item.lastReminderEmail && item.reminderEmailCount && item.lastReminderAmountOpen !== item.amountOpen" class="style-description-small">
                            {{ $t('dd903ff5-0b40-4393-b9d2-fc45af9b07c3', {amount: formatPrice(item.lastReminderAmountOpen)}) }}
                        </p>
                        <p v-if="!item.lastReminderEmail || item.reminderEmailCount === 0" class="style-description-small">
                            {{ $t('df3121cb-c5b1-405a-a34e-fd4d92d468ac') }}
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
    return $t('28c2bc66-231f-44f3-9249-c1981b871a1f');
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
                    Toast.error($t(`22541ecc-ba4f-4a91-b8d3-8213bfaaea0b`)).show();
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
