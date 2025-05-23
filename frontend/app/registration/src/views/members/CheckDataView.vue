<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`b4cba044-12c3-464d-8bc1-2873996f02fa`)" />

        <main>
            <h1>{{ $t('d14e4e63-c77d-44d9-b8d0-adf05e299303') }}</h1>

            <template v-if="members.length > 0">
                <hr><h2>
                    <div>{{ $t('97dc1e85-339a-4153-9413-cca69959d731') }}</div>
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
                {{ $t('a88bd350-756b-4fcd-ba06-585fabd0e197') }}
            </p>

            <template v-if="parents.length">
                <hr><h2>{{ $t('00306f91-9f66-4cc3-9c8e-36c08f9964d7') }}</h2>
                <p>{{ $t('b3304780-9d9a-47c2-97f5-13b6fbb03307') }}</p>

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
                <hr><h2>{{ $t('d86b0f9d-ad2d-4bb6-9ea0-b41a7925094f') }}</h2>

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
import { EditParentView, MemberIcon, NavigationActions, useEditMember, usePlatformFamilyManager } from '@stamhoofd/components';
import { useMemberManager } from '@stamhoofd/networking';
import { Address, Parent, PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';

const memberManager = useMemberManager();
const present = usePresent();
const platformFamilyManager = usePlatformFamilyManager();

const members = computed(() => memberManager.family.members);
const parents = computed(() => memberManager.family.parents);
const addresses = computed(() => memberManager.family.addresses);
const editMember = useEditMember();

async function checkAllMemberData(member: PlatformMember) {
    await editMember(member, { title: $t(`b4cba044-12c3-464d-8bc1-2873996f02fa`) });
}

function editAddress(_address: Address) {
    // todo
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
