<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`Gegevens nakijken`)"/>

        <main>
            <h1>{{ $t('680de5c5-9258-47a2-8514-f436252e563f') }}</h1>

            <template v-if="members.length > 0">
                <hr><h2>
                    <div>{{ $t('bb834e1a-02ac-4db3-bbd7-8db8f5b0d981') }}</div>
                </h2>

                <STList class="illustration-list">
                    <STListItem v-for="member in members" :key="member.id" class="right-stack" :selectable="true" @click.stop="checkAllMemberData(member)">
                        <template #left>
                            <MemberIcon :member="member"/>
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
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>
                </STList>
            </template>
            <p v-else class="info-box">
                {{ $t('ae4bc21a-b898-4255-acfb-2e8ce661da0b') }}
            </p>

            <template v-if="parents.length">
                <hr><h2>{{ $t('41afae13-62ec-4cc7-ba58-c8c1a4db2589') }}</h2>
                <p>{{ $t('5c6a33a0-a2d7-4929-8ab1-02b43af43127') }}</p>

                <STList class="illustration-list">
                    <STListItem v-for="parent in parents" :key="parent.id" class="right-stack" :selectable="true" @click.stop="editParent(parent)">
                        <template #left>
                            <img src="~@stamhoofd/assets/images/illustrations/group.svg"></template>

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
                            <span class="icon arrow-right-small gray"/>
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="addresses.length">
                <hr><h2>{{ $t('b79c50f0-adc5-4a19-a9da-f75e071a4c40') }}</h2>

                <STList class="illustration-list">
                    <STListItem v-for="address in addresses" :key="address.toString()" class="right-stack" :selectable="false">
                        <template #left>
                            <img src="~@stamhoofd/assets/images/illustrations/house.svg"></template>

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
import { Address, Parent, PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useMemberManager } from '@stamhoofd/networking';

const memberManager = useMemberManager();
const present = usePresent()
const platformFamilyManager = usePlatformFamilyManager();

const members = computed(() => memberManager.family.members);
const parents = computed(() => memberManager.family.parents);
const addresses = computed(() => memberManager.family.addresses);
const editMember = useEditMember();

async function checkAllMemberData(member: PlatformMember) {
    await editMember(member, {title: 'Gegevens nakijken'})
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
                    await navigate.pop({force: true});
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}

</script>
