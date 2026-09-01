<template>
    <LoadingViewTransition>
        <div v-if="!loadingPayingOrganization" class="st-view">
            <STNavigationBar :title="title">
                <template #right>
                    <a v-tooltip="$t('Documentatie bekijken')" :href="LocalizedDomains.getDocs('boekhoudingsmodule')" class="icon button help" target="_blank" />

                    <button v-if="hasPrevious || hasNext" v-tooltip="$t('%hg')" type="button" class="button icon arrow-up" :disabled="!hasPrevious" @click="goBack" />
                    <button v-if="hasNext || hasPrevious" v-tooltip="$t('%hh')" type="button" class="button icon arrow-down" :disabled="!hasNext" @click="goForward" />
                </template>
            </STNavigationBar>

            <main>
                <p :class="'style-title-prefix'">
                    {{ title }}
                </p>

                <h1 class="style-navigation-title" @click="onClick">
                    {{ item.object.name }} <span v-if="canClick" class="icon arrow-right-small gray" />
                </h1>

                <p v-if="item.objectType === ReceivableBalanceType.userWithoutMembers" class="info-box">
                    {{ $t("%1HP") }}
                </p>

                <dl class="details-grid">
                    <template v-if="item.object.uri">
                        <dt>{{ $t('%5') }}</dt>
                        <dd>
                            <span v-copyable class="style-copyable">{{ item.object.uri }}</span>
                        </dd>
                    </template>
                    <template v-if="(item.objectType === ReceivableBalanceType.userWithoutMembers || item.objectType === ReceivableBalanceType.user) && item.object.contacts.length === 1 && item.object.contacts[0].emails.length === 1">
                        <dt>{{ $t('E-mailadres') }}</dt>
                        <dd>
                            <EmailAddress :email="item.object.contacts[0].emails[0]" />
                        </dd>
                    </template>
                    <template v-if="payingOrganization && payingOrganization.address">
                        <dt>{{ $t('Adres') }}</dt>
                        <dd>
                            <span v-copyable class="style-copyable">{{ payingOrganization.address }}</span>
                        </dd>
                    </template>

                    <template v-if="organization && organization.privateMeta?.balanceNotificationSettings?.enabled && item.amountOpen > 0 && (item.objectType === ReceivableBalanceType.organization || item.objectType === ReceivableBalanceType.user)">
                        <dt>{{ $t('Herinneringsmail') }}</dt>
                        <dd>
                            <p>{{ item.lastReminderEmail && item.reminderEmailCount > 0 ? formatDateTime(item.lastReminderEmail, true) : $t('%hm') }}</p>
                            <p v-if="item.lastReminderEmail && item.reminderEmailCount > 1" class="style-description-small">
                                {{ $t('%hn', {count: item.reminderEmailCount.toString()}) }}
                            </p>
                            <p v-if="item.lastReminderEmail && item.reminderEmailCount && item.lastReminderAmountOpen !== item.amountOpen" class="style-description-small">
                                {{ $t('%ho', {amount: formatPrice(item.lastReminderAmountOpen)}) }}
                            </p>
                            <p v-if="!item.lastReminderEmail || item.reminderEmailCount === 0" class="style-description-small">
                                {{ $t('De eerste e-mail wordt morgenvroeg verzonden.') }}
                            </p>
                        </dd>
                    </template>
                </dl>

                <ReceivableBalanceBox :item="item" :member="member" :hide-segmented-control="item.objectType !== ReceivableBalanceType.organization" :paying-organization="payingOrganization" />
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';

import LoadingViewTransition from '#containers/LoadingViewTransition.vue';
import PromiseView from '#containers/PromiseView.vue';
import EmailAddress from '#email/EmailAddress.vue';
import { useMembersObjectFetcher } from '#fetchers/useMembersObjectFetcher.ts';
import { useExternalOrganization } from '#groups/hooks/useExternalOrganization.ts';
import { useBackForward } from '#hooks/useBackForward.ts';
import { Toast } from '#overlays/Toast.ts';
import type { PlatformMember, ReceivableBalance } from '@stamhoofd/structures';
import { LimitedFilteredRequest, ReceivableBalanceType } from '@stamhoofd/structures';
import { computed } from 'vue';
import ReceivableBalanceBox from './ReceivableBalanceBox.vue';
import { useOrganization } from '#hooks/useOrganization.ts';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n/LocalizedDomains';

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
const organization = useOrganization();

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

const helpText = props.item.objectType === ReceivableBalanceType.member || props.item.objectType === ReceivableBalanceType.user || props.item.objectType === ReceivableBalanceType.userWithoutMembers ? $t('%hf') : null;

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
                return AsyncComponent(() => import('#members/MemberSegmentedView.vue'), {
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
