<template>
    <div class="st-view">
        <STNavigationBar title="Gegevens nakijken" />

        <main>
            <h1>Gegevens nakijken</h1>

            <template v-if="members.length > 0">
                <hr>
                <h2>
                    <div>Leden</div>
                </h2>

                <STList class="illustration-list">
                    <STListItem v-for="member in members" :key="member.id" class="right-stack" :selectable="true" @click.stop="editMember(member)">
                        <template #left>
                            <img v-if="member.patchedMember.details.gender === 'Female'" src="~@stamhoofd/assets/images/illustrations/member-female.svg">
                            <img v-else src="~@stamhoofd/assets/images/illustrations/member-male.svg">
                        </template>

                        <h2 class="style-title-list">
                            {{ member.patchedMember.name }}
                        </h2>
                        <p v-if="member.groups.length > 0" class="style-description">
                            Ingeschreven voor {{ member.groups.map(g => g.settings.name ).join(", ") }}
                        </p>
                        <p v-else class="style-description-small">
                            Nog niet ingeschreven
                        </p>
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
                Er zijn nog geen leden gekoppeld met jouw account.
            </p>

            <template v-if="parents.length">
                <hr>
                <h2>Ouders</h2>

                <STList class="illustration-list">
                    <STListItem v-for="parent in parents" :key="parent.id" class="right-stack" :selectable="true" @click.stop="editParent(parent)">
                        <template #left>
                            <img src="~@stamhoofd/assets/images/illustrations/admin.svg">
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
                <hr>
                <h2>Adressen</h2>
                <p>
                    Je kan hier de adressen wijzigen voor iedereen met dat adres, of je kan hierboven bij een lid <template v-if="parents.length">
                        of ouder
                    </template> een nieuw adres toevoegen.
                </p>

                <STList class="illustration-list">
                    <STListItem v-for="address in addresses" :key="address.toString()" class="right-stack" :selectable="true" @click.stop="editAddress(address)">
                        <template #left>
                            <img src="~@stamhoofd/assets/images/illustrations/house.svg">
                        </template>

                        <h2 class="style-title-list">
                            {{ address.street }} {{ address.number }}
                        </h2>
                        <p class="style-description">
                            {{ address.postalCode }} {{ address.city }}
                        </p>


                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { EditParentView, NavigationActions, usePlatformFamilyManager } from '@stamhoofd/components';
import { Address, Parent, PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useMemberManager } from '../../getRootView';

const memberManager = useMemberManager();
const present = usePresent()
const platformFamilyManager = usePlatformFamilyManager();

const members = computed(() => memberManager.family.members);
const parents = computed(() => memberManager.family.parents);
const addresses = computed(() => memberManager.family.addresses);

function editMember(_member: PlatformMember) {
    // todo
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
