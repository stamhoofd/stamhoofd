<template>
    <hr>
    <h2>{{ $t('%YY') }}</h2>
    <p>{{ $t('%YZ') }}</p>

    <div v-if="shouldShowSearch" class="input-with-buttons">
        <div>
            <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                <input v-model="searchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`%KC`)">
            </form>
        </div>
    </div>

    <p v-if="sortedMembers.length === 0" class="info-box">
        {{ $t('%Ya') }}
    </p>
    <p v-if="filteredMembers.length === 0" class="info-box">
        {{ $t('%1AX') }}
    </p>
    <STList v-else>
        <STListItem v-for="member in filteredLimitedMembers" :key="member.id" :selectable="true" class="right-stack" @click="editMember(member)">
            <template #left>
                <span v-if="memberHasFullAccess(member)" class="icon layered" :v-tooltip="$t('%Yb')">
                    <span class="icon user-admin-layer-1" />
                    <span class="icon user-admin-layer-2 yellow" />
                </span>
                <span v-else-if="memberHasNoRoles(member)" class="icon layered" :v-tooltip="$t('%Yc')">
                    <span class="icon user-blocked-layer-1" />
                    <span class="icon user-blocked-layer-2 red" />
                </span>
                <span v-else class="icon user" />
            </template>

            <h2 class="style-title-list">
                <span>{{ member.name }}</span>
            </h2>
            <p class="style-description-small">
                {{ member.users.map(u => u.email).join(', ') }}
            </p>
            <p class="style-description-small">
                {{ Formatter.joinLast(member.getResponsibilities(organization), ', ', ' en ') }}
            </p>

            <template #right>
                <span v-if="member.id === me?.memberId" class="style-tag">
                    {{ $t('%Yd') }}
                </span>
                <span v-else-if="!member.users.find(u => u.hasAccount)" class="icon email gray" :v-tooltip="$t('%Ye')" />
                <span><span class="icon gray edit" /></span>
            </template>
        </STListItem>
    </STList>

    <p v-if="shouldShowMoreButton" class="style-button-bar">
        <button type="button" class="button text" @click="showAll = true">
            {{ $t('%1AY', {count: showMoreCount}) }}
        </button>
    </p>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import MemberSegmentedView from '#members/MemberSegmentedView.vue';
import PromiseView from '#containers/PromiseView.vue';
import { useMembersObjectFetcher } from '#fetchers/useMembersObjectFetcher.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { useUser } from '#hooks/useUser.ts';
import type { MemberAdmin, PlatformMember } from '@stamhoofd/structures';
import { LimitedFilteredRequest } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { useAdmins } from './hooks/useAdmins';

const me = useUser();
const organization = useOrganization();
const { memberHasFullAccess, memberHasNoRoles, sortedMembers } = useAdmins();
const MAX_VISIBLE_DEFAULT = 5;
const searchQuery = ref('');
const showAll = ref(false);

const filteredMembers = computed(() => {
    if (!searchQuery.value) {
        return sortedMembers.value;
    }
    const query = searchQuery.value.toLowerCase();
    return sortedMembers.value.filter((member) => {
        return member.name.toLowerCase().includes(query) || member.users.some(user => user.email.toLowerCase().includes(query));
    });
});

const showMoreCount = computed(() => {
    return filteredMembers.value.length - MAX_VISIBLE_DEFAULT;
});

const shouldShowSearch = computed(() => {
    return sortedMembers.value.length - MAX_VISIBLE_DEFAULT >= 2;
});
const shouldShowMoreButton = computed(() => {
    return !showAll.value && showMoreCount.value >= 2;
});

const filteredLimitedMembers = computed(() => {
    if (!shouldShowMoreButton.value) {
        return filteredMembers.value;
    }
    return filteredMembers.value.slice(0, MAX_VISIBLE_DEFAULT);
});

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur();
}

const objectFetcher = useMembersObjectFetcher({});
const present = usePresent();

async function editMember(memberAdmin: MemberAdmin) {
    const component = new ComponentWithProperties(PromiseView, {
        promise: async () => {
            const { results } = await objectFetcher.fetch(new LimitedFilteredRequest({
                filter: {
                    id: memberAdmin.id,
                },
                limit: 1,
            }));
            if (!results.length) {
                return;
            }
            const member = results[0] as PlatformMember;
            return new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(MemberSegmentedView, {
                    member,
                }),
            });
        },
    });

    await present({
        components: [component],
        modalDisplayStyle: 'popup',
    });
}
</script>
