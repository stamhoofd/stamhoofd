<template>
    <SaveView :loading="saving" :title="title" :disabled="!isNew && !hasChanges" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errorBox" />
        <STInputBox title="Naam" error-fields="name" :error-box="errorBox">
            <input v-model="name" enterkeyhint="next" class="input" type="text" placeholder="Naam">
        </STInputBox>

        <div class="container">
            <hr>
            <h2>Rollen</h2>
            <p>Je kan een API-key verschillende rollen geven, net zoals een beheerder. Hiermee kan je jouw key beter beveiligen en enkel toegang geven waarvoor je het nodig hebt.</p>

            <EditUserPermissionsBox :user="patchedUser" @patch="addPatch($event)" />
        </div>

        <hr v-if="!isNew">
        <h2 v-if="!isNew">
            Verwijderen
        </h2>

        <button v-if="!isNew" class="button secundary danger" type="button" @click="deleteMe">
            <span class="icon trash" />
            <span>Verwijderen</span>
        </button>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, Decoder, PartialWithoutMethods, patchContainsChanges, PatchType } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, EmailInput, ErrorBox, SaveView, Spinner, STErrorsDefault, STInputBox, STList, STListItem, Toast, Validator } from "@stamhoofd/components";
import Tooltip from '@stamhoofd/components/src/directives/Tooltip';
import { SessionManager } from '@stamhoofd/networking';
import { ApiUser, ApiUserWithToken, PermissionLevel, Permissions, User, Version } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";


import CopyApiTokenView from './CopyApiTokenView.vue';
import EditUserPermissionsBox from './EditUserPermissionsBox.vue';

@Component({
    components: {
        STInputBox,
        STErrorsDefault,
        Checkbox,
        EmailInput,
        STList,
        STListItem,
        Spinner,
        SaveView,
        EditUserPermissionsBox
    },
    directives: {
        tooltip: Tooltip
    },
    filters: {
        date: Formatter.date.bind(Formatter)
    }
})
export default class ApiUserView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    deleting = false

    @Prop({ required: true })
        user!: ApiUser

    @Prop({ required: true })
        callback!: () => void

    patchUser: AutoEncoderPatchType<ApiUser> = ApiUser.patch({ id: this.user.id })

    @Prop({ required: true })
        isNew!: boolean

    get hasChanges() {
        return patchContainsChanges(this.patchUser, this.user, { version: Version })
    }

    get title() {
        if (this.isNew) {
            return 'Nieuwe API-key'
        }
        return 'API-key bewerken'
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    get organization() {
        return this.$organization
    }

    get patchedUser() {
        return this.user.patch(this.patchUser)
    }

    get fullAccess() {
        const user = this.patchedUser
        return !!user.permissions && user.permissions.hasFullAccess(this.organization.privateMeta?.roles ?? [])
    }

    async save() {
        if (this.deleting || this.saving) {
            return;
        }

        this.saving = true

        const errors = new SimpleErrors()

        if (this.name.length < 2) {
            errors.addError(new SimpleError({
                code: "invalid_field",
                message: "Vul een naam in",
                field: "name"
            }))
        }
        
        let valid = false

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors)
        } else {
            this.errorBox = null
            valid = true
        }
        valid = valid && await this.validator.validate()

        // TODO: validate if at least email or name is filled in

        if (!valid) {
            this.saving = false
            return;
        }

        const permissions = Permissions.patch({ level: this.fullAccess ? PermissionLevel.Full : (PermissionLevel.None )})

        this.addPermissionsPatch(permissions)

        try {
            let user: ApiUser;
            if (this.isNew) {
                const response = await this.$context.authenticatedServer.request({
                    method: "POST",
                    path: "/api-keys",
                    body: this.patchedUser,
                    decoder: ApiUserWithToken as Decoder<ApiUserWithToken>
                })
                user = response.data;
            } else {
                const response = await this.$context.authenticatedServer.request({
                    method: "PATCH",
                    path: "/api-keys/"+this.user.id,
                    body: this.patchUser,
                    decoder: ApiUser as Decoder<ApiUser>
                })
                user = response.data;
            }

            // Copy all data
            this.user.set(user);
            this.patchUser = ApiUser.patch({ id: this.user.id });

            this.callback()

            if (this.isNew) {
                this.show({
                    components: [
                        new ComponentWithProperties(CopyApiTokenView, { user })
                    ],
                    replace: 1,
                    animated: true
                })
            } else {
                this.pop({ force: true })
                this.saving = false
            }
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            this.saving = false
        }
    }

    async deleteMe() {
        if (this.deleting || this.saving) {
            return false;
        }
        
        if (this.isNew) {
            return false;
        }

        if (!await CenteredMessage.confirm("Ben je zeker dat je deze API-key wilt verwijderen?", "Verwijderen")) {
            return false;
        }

        this.deleting = true;

        try {
            // Patch the user
            await this.$context.authenticatedServer.request({
                method: "DELETE",
                path: "/api-keys/"+this.user.id,
            })

            this.callback()
            this.pop({ force: true })
            this.deleting = false

            new Toast("API-key '"+this.user.name+"' werd verwijderd", "success").setHide(2000).show()
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            this.deleting = false;
        }
        return false;
    }

    /// --------------------------------------------------------
    /// --------------------- Map helpers ----------------------
    /// --------------------------------------------------------

    addPatch(patch: PartialWithoutMethods<PatchType<User>>) {
        this.patchUser = this.patchUser.patch(patch)
    }

    addPermissionsPatch(patch: PartialWithoutMethods<PatchType<Permissions>>) {
        this.addPatch({ permissions: Permissions.patch(patch) })
    }


    /// --------------------------------------------------------
    /// --------------------- Mappers --------------------------
    /// --------------------------------------------------------

    get name() {
        return this.patchedUser.name ?? ""
    }

    set name(name: string) {
        this.addPatch({ name })
    }
}
</script>