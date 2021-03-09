<template>
    <form class="st-view accept-invite-view" @submit.prevent="submit">
        <STNavigationBar title="Ongeldige uitnodiging">
            <button slot="right" type="button" class="button icon gray close" @click="dismiss" />
        </STNavigationBar>
        <main>
            <h1>Deze uitnodiging is niet langer geldig 😢</h1>
            
            <STErrorsDefault :error-box="errorBox" />

            <p class="st-list-description" v-if="invite && invite.sender.firstName">{{ invite.sender.firstName }} heeft jou uitgenodigd als beheerder van {{ invite.organization.name }}. Vraag om de uitnodiging opnieuw te versturen, want hij is verlopen.</p>
            <p v-else class="st-list-description">Vraag om de uitnodiging opnieuw te versturen.</p>
        </main>
    </form>
</template>

<script lang="ts">
import { Decoder, StringDecoder, ObjectData, VersionBoxDecoder, ArrayDecoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties,NavigationMixin, NavigationController } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, LoadingButton, STFloatingFooter, STInputBox, STNavigationBar, ErrorBox, STErrorsDefault, Validator, EmailInput } from "@stamhoofd/components"
import { Sodium } from '@stamhoofd/crypto';
import { NetworkManager,Session, SessionManager, LoginHelper } from '@stamhoofd/networking';
import { ChallengeResponseStruct,KeyConstants,NewUser, OrganizationSimple, Token, User, Version, Invite, InviteKeychainItem, InviteUserDetails, KeychainItem, TradedInvite } from '@stamhoofd/structures';
import { Component, Mixins, Prop } from "vue-property-decorator";

import LoginView from '../login/LoginView.vue';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';

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