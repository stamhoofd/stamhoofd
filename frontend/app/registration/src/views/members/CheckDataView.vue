<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`%uC`)" />

        <main>
            <h1>{{ $t('%uC') }}</h1>

            <template v-if="members.length > 0">
                <hr><h2>
                    <div>{{ $t('%1EH') }}</div>
                </h2>

                <STList class="illustration-list">
                    <STListItem v-for="member in members" :key="member.id" class="right-stack" :selectable="true" @click.stop="checkAllMemberData(member)">
                        <template #left>
                            <MemberIcon :member="member" />
                        </template>

                        <h2 class="style-title-list">
                            {{ member.patchedMember.name }}
                        </h2>

                        <p v-if="member.patchedMember.details.email" class="style-description">
                            {{ member.patchedMember.details.email }}
                        </p>
                        <p v-if="member.patchedMember.details.phone" class="style-description">
                            {{ member.patchedMember.details.phone }}
                        </p>
                        <p v-if="member.patchedMember.details.address" class="style-description">
                            {{ member.patchedMember.details.address }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>
            <p v-else class="info-box">
                {{ $t('%XG') }}
            </p>

            <template v-if="parents.length">
                <hr><h2>{{ $t('%XH') }}</h2>
                <p>{{ $t('%XI') }}</p>

                <STList class="illustration-list">
                    <STListItem v-for="parent in parents" :key="parent.id" class="right-stack" :selectable="true" @click.stop="editParent(parent)">
                        <template #left>
                            <img src="~@stamhoofd/assets/images/illustrations/group.svg">
                        </template>

                        <h2 class="style-title-list">
                            {{ parent.firstName }} {{ parent.lastName || "" }}
                        </h2>
                        <p class="style-description">
                            {{ parent.email }}
                        </p>
                        <p class="style-description">
                            {{ parent.phone }}
                        </p>
                        <p class="style-description">
                            {{ parent.address }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="addresses.length">
                <hr><h2>{{ $t('%XJ') }}</h2>

                <STList class="illustration-list">
                    <STListItem v-for="address in addresses" :key="address.toString()" class="right-stack" :selectable="false">
                        <template #left>
                            <img src="~@stamhoofd/assets/images/illustrations/house.svg">
                        </template>

                        <h2 class="style-title-list">
                            {{ address.street }} {{ address.number }}
                        </h2>
                        <p class="style-description">
                            {{ address.postalCode }} {{ address.city }}
                        </p>
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import EditParentView from '@stamhoofd/components/members/components/edit/EditParentView.vue';
import MemberIcon from '@stamhoofd/components/members/components/MemberIcon.vue';
import { useEditMember } from '@stamhoofd/components/members/hooks/useEditMember';
import { usePlatformFamilyManager } from '@stamhoofd/components/members/PlatformFamilyManager';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions';
import { useMemberManager } from '@stamhoofd/networking/MemberManager';
import type { Parent, PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';

const memberManager = useMemberManager();
const present = usePresent();
const platformFamilyManager = usePlatformFamilyManager();

const members = computed(() => memberManager.family.members);
const parents = computed(() => memberManager.family.parents);
const addresses = computed(() => memberManager.family.addresses);
const editMember = useEditMember();

async function checkAllMemberData(member: PlatformMember) {
    await editMember(member, { title: $t(`%uC`) });
}

async function editParent(parent: Parent) {
    const clone = memberManager.family.clone();
    await present({
        components: [
            new ComponentWithProperties(EditParentView, {
                parent: parent.clone(),
                isNew: false,
                family: clone,
                saveHandler: async (navigate: NavigationActions) => {
                    await platformFamilyManager.save(clone.members);
                    memberManager.family.copyFromClone(clone);
                    await navigate.pop({ force: true });
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

</script>
