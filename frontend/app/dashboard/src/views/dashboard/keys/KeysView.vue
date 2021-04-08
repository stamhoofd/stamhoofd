<template>
    <div id="keys-view" class="st-view background">
        <STNavigationBar title="Instellingen">
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>

        <main>
            <h1>
                Gebruikers goedkeuren
            </h1>
            <p>End-to-end versleuteling ligt aan de basis van de beveiliging van Stamhoofd. Als een gebruiker zijn wachtwoord vergeet, of een nieuw account aanmaakt binnen hetzelfde gezin, dan heeft die gebruiker geen toegang meer tot de encryptiesleutels. De gebruiker krijgt dan een melding dat hun account nog moet worden goedgekeurd. Ze kunnen wel al inschrijven, maar ze kunnen gewoon de bestaande gegevens niet bekijken (behalve voornaam) tenzij ze alles opnieuw ingeven. Hier kan je nakijken voor wie dit het geval is en kan je nieuwe sleutels delen met deze gebruikers. Dit kan niet worden geautomatiseerd of uitgeschakeld.</p>
        
            <STErrorsDefault :error-box="errorBox" />

            <STList>
                <STListItem v-for="user in users" :key="user.id">
                    <span slot="left" class="icon user" />

                    <h2 class="style-title-list">
                        {{ user.user.email }} ({{ user.name }})
                    </h2>
                    <p class="style-description">
                        Leden: {{ user.members.map(m => m.name).join(', ') }}
                    </p>

                    <button slot="right" class="button text green" @click="acceptUser(user)">
                        <span class="icon success green" />
                        <span>Toegang geven</span>
                    </button>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from "@simonbackx/simple-encoding";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, ErrorBox, LoadingButton, STErrorsDefault,STList, STListItem,STNavigationBar, STToolbar, Toast } from "@stamhoofd/components";
import { LoginHelper, SessionManager } from "@stamhoofd/networking";
import { EncryptedMemberWithRegistrations, MemberWithRegistrations, User } from "@stamhoofd/structures";
import { Component, Mixins } from "vue-property-decorator";

import { MemberManager } from "../../../classes/MemberManager";
import { OrganizationManager } from "../../../classes/OrganizationManager";

class UserWithMembers {
    user: User
    members: MemberWithRegistrations[]

    constructor(user: User, members: MemberWithRegistrations[]) {
        this.user = user
        this.members = members
    }

    get name() {
        for (const member of this.members) {
            for (const parent of member.details.parents) {
                if (parent.email === this.user.email && parent.name) {
                    return parent.name
                }
            }

            if (member.details.email && member.details.email === this.user.email && member.name) {
                return member.name
            }
        }
        
        return "Geen naam gevonden"
    }
}

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        BackButton,
        LoadingButton,
        STErrorsDefault,
        STList,
        STListItem
    }
})
export default class KeysView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null

    loading = false
    members: MemberWithRegistrations[] = []

    mounted() {
        this.reload().catch(e => {
            console.error(e)
        })
    }

    async reload() {
        try {
            this.loading = true
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "GET",
                path: "/organization/key-requests",
                decoder: new ArrayDecoder(EncryptedMemberWithRegistrations as Decoder<EncryptedMemberWithRegistrations>)
            })
            this.members = await MemberManager.decryptMembersWithRegistrations(response.data)
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
    }

    get users() {
        const users = new Map<string, UserWithMembers>()
        for (const member of this.members) {
            for (const u of member.users) {
                if (u.requestKeys) {
                    const existing = users.get(u.id)
                    if (existing) {
                        existing.members.push(member)
                    } else {
                        users.set(u.id, new UserWithMembers(u, [member]))
                    }
                }
            }
        }
        return [...users.values()]
    }

    async acceptUser(user: UserWithMembers) {
        try {
            // Create a separate key for every member because different users might have access
            for (const member of user.members) {
                await MemberManager.createNewMemberKey([member])
            }

            // Update user
            await LoginHelper.patchUser(SessionManager.currentSession!, User.patch({
                id: user.user.id,
                requestKeys: false
            }))
            OrganizationManager.organization.privateMeta!.requestKeysCount--
            await this.reload()
            new Toast("Alle gebruikers die verbonden zijn met deze leden hebben nu opnieuw toegang tot alle gegevens", "icon success green").show()
        } catch (e) {
            CenteredMessage.fromError(e).show()
        }
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

</style>