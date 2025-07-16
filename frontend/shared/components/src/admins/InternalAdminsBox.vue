<template>
    <hr>
    <h2>{{ $t('8f75871d-17d9-49b1-aaf2-c7054e058372') }}</h2>
    <p>{{ $t('ee16437e-ecc8-42c5-91ef-e2546c71ba12') }}</p>

    <div v-if="shouldShowSearch" class="input-with-buttons">
        <div>
            <form class="input-icon-container icon search gray" @submit.prevent="blurFocus">
                <input v-model="searchQuery" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" :placeholder="$t(`01e2b860-7045-4a0c-84ca-2303346d14b2`)">
            </form>
        </div>
    </div>

    <p v-if="sortedMembers.length === 0" class="info-box">
        {{ $t('4d9168af-27ed-438e-acd9-756474dd6f5e') }}
    </p>
    <p v-if="filteredMembers.length === 0" class="info-box">
        {{ $t('34416687-b59a-4637-92a0-fac711d7d231') }}
    </p>
    <STList v-else>
        <STListItem v-for="member in filteredLimitedMembers" :key="member.id" :selectable="true" class="right-stack" @click="editMember(member)">
            <template #left>
                <span v-if="memberHasFullAccess(member)" class="icon layered" :v-tooltip="$t('06e0f25f-f601-4359-a95d-b72fd79ecbdd')">
                    <span class="icon user-admin-layer-1" />
                    <span class="icon user-admin-layer-2 yellow" />
                </span>
                <span v-else-if="memberHasNoRoles(member)" class="icon layered" :v-tooltip="$t('3bb4e938-ca4e-4318-a86d-002ba6035fd0')">
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
                    {{ $t('50f1bd97-6ff4-44cb-a44d-45672218b7f8') }}
                </span>
                <span v-else-if="!member.users.find(u => u.hasAccount)" class="icon email gray" :v-tooltip="$t('0e7858e2-873b-4d49-9b5b-d9b15ea5f97f')" />
                <span><span class="icon gray edit" /></span>
            </template>
        </STListItem>
    </STList>

    <p v-if="shouldShowMoreButton" class="style-button-bar">
        <button type="button" class="button text" @click="showAll = true">
            {{ $t('96140ac1-d193-4ad1-9f33-f5241f00d176', {count: showMoreCount}) }}
        </button>
    </p>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { MemberSegmentedView, PromiseView, useMembersObjectFetcher, useOrganization, useUser } from '@stamhoofd/components';
import { LimitedFilteredRequest, MemberAdmin, PlatformMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { useAdmins } from './hooks/useAdmins';

const me = useUser();
const organization = useOrganization();
const { memberHasFullAccess, memberHasNoRoles, sortedMembers } = useAdmins();
let MAX_VISIBLE_DEFAULT = 5;
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
