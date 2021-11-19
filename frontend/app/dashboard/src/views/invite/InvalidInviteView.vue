<template>
    <form class="st-view accept-invite-view" @submit.prevent="submit">
        <STNavigationBar title="Ongeldige uitnodiging">
            <button slot="right" type="button" class="button icon gray close" @click="dismiss" />
        </STNavigationBar>
        <main>
            <h1>Deze uitnodiging is niet langer geldig 😢</h1>
            
            <p v-if="invite && invite.sender.firstName" class="st-list-description">
                {{ invite.sender.firstName }} heeft jou uitgenodigd als beheerder van {{ invite.organization.name }}. Vraag om de uitnodiging opnieuw te versturen, want hij is verlopen.
            </p>
            <p v-else class="st-list-description">
                Vraag om de uitnodiging opnieuw te versturen.
            </p>
        </main>
    </form>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { EmailInput, LoadingButton, STErrorsDefault, STFloatingFooter, STInputBox, STNavigationBar } from "@stamhoofd/components"
import { Invite } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STInputBox,
        LoadingButton,
        EmailInput,
        STErrorsDefault
    }
})
export default class InvalidInviteView extends Mixins(NavigationMixin){
    @Prop({ required: false, default: null })
    invite!: Invite | null
}
</script>