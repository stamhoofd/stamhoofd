<template>
    <div class="st-view">
        <STNavigationBar :pop="canPop" :dismiss="canDismiss" title="Gegevens nakijken" />

        <main>
            <h1>Gegevens nakijken</h1>

            <template v-if="members.length > 0">
                <hr>
                <h2 class="style-with-button">
                    <div>Leden</div>
                    <div>
                        <button v-if="isAcceptingNewMembers" type="button" class="button text gray" @click="addMember">
                            <span class="icon add" />
                            <span>Nieuw</span>
                        </button>
                    </div>
                </h2>

                <STList class="illustration-list">
                    <STListItem v-for="member in members" :key="member.id" class="right-stack" :selectable="true" @click.stop="editMember(member)">
                        <img v-if="member.details.gender === 'Female'" slot="left" src="@stamhoofd/assets/images/illustrations/member-female.svg">
                        <img v-else slot="left" src="@stamhoofd/assets/images/illustrations/member-male.svg">

                        <h2 class="style-title-list">
                            {{ member.firstName }} {{ member.details ? member.details.lastName : "" }}
                        </h2>
                        <p v-if="member.groups.length > 0" class="style-description">
                            Ingeschreven voor {{ member.groups.map(g => g.settings.name ).join(", ") }}
                        </p>
                        <p v-else class="style-description-small">
                            Nog niet ingeschreven
                        </p>

                        <template slot="right">
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>
            <p v-else class="info-box">
                Er zijn nog geen leden bekend in het systeem voor dit account.
            </p>

            <template v-if="parents.length">
                <hr>
                <h2>Ouders</h2>

                <STList class="illustration-list">
                    <STListItem v-for="parent in parents" :key="parent.id" class="right-stack" :selectable="true" @click.stop="editParent(parent)">
                        <img slot="left" src="@stamhoofd/assets/images/illustrations/admin.svg">

                        <h2 class="style-title-list">
                            {{ parent.firstName }} {{ parent.lastName || "" }}
                        </h2>
                        <p class="style-description">
                            {{ parent.email }}
                        </p>
                        <p class="style-description">
                            {{ parent.phone }}
                        </p>

                        <template slot="right">
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-if="addresses.length">
                <hr>
                <h2>Adressen</h2>
                <p v-if="parents.length">
                    Je kan nieuwe adressen toevoegen bij leden en/of ouders
                </p>
                <p v-else>
                    Je kan nieuwe adressen toevoegen bij leden.
                </p>

                <STList class="illustration-list">
                    <STListItem v-for="address in addresses" :key="address.id" class="right-stack" :selectable="true" @click.stop="editAddress(address)">
                        <img slot="left" src="@stamhoofd/assets/images/illustrations/house.svg">

                        <h2 class="style-title-list">
                            {{ address.street }} {{ address.number }}
                        </h2>
                        <p class="style-description">
                            {{ address.postalCode }} {{ address.city }}
                        </p>


                        <template slot="right">
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, OrganizationLogo, STList, STListItem, STNavigationBar } from "@stamhoofd/components";
import { Address, MemberWithRegistrations, Parent } from "@stamhoofd/structures";
import { Component, Mixins } from "vue-property-decorator";

import AddressView from "../members/details/AddressView.vue";
import { createMemberComponent } from "../members/details/createMemberComponent";
import ParentView from "../members/details/ParentView.vue";
import MemberView from "../members/MemberView.vue";

@Component({
    components: {
        STNavigationBar,
        OrganizationLogo,
        STList,
        STListItem,
        BackButton
    }
})
export default class CheckDataView extends Mixins(NavigationMixin){
    

    get organization() {
        return this.$organization
    }

    get members() {
        if (this.$memberManager.members) {
            return this.$memberManager.members
        }
        return []
    }

    get parents() {
        return this.$memberManager.getParents()
    }

    get addresses() {
        return this.$memberManager.getAddresses()
    }

    get isAcceptingNewMembers() {
        return this.organization.isAcceptingNewMembers(!!this.$context.user?.permissions)
    }

    async addMember() {
        const component = await createMemberComponent(this.$memberManager)
        if (component) {
            this.show(component)
        }
    }

    editMember(member: MemberWithRegistrations) {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(MemberView, { member })
        }).setDisplayStyle("popup"))
    }

    editParent(parent: Parent) {
        this.present(new ComponentWithProperties(ParentView, {
            parent,
            handler: async (parent: Parent, component: NavigationMixin) => {
                await this.$memberManager.patchAllMembersWith()
                component.pop({ force: true })
            }
        }).setDisplayStyle("popup"))
    }

    editAddress(address: Address) {
        this.present(new ComponentWithProperties(AddressView, {
            address,
            handler: async (address: Address, component: NavigationMixin) => {
                await this.$memberManager.patchAllMembersWith()
                component.pop({ force: true })
            }
        }).setDisplayStyle("sheet"))
    }
}
</script>