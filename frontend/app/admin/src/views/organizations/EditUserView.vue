<template>
    <div class="st-view user-edit-view">
        <STNavigationBar :title="isNew ? 'Nieuwe beheerder toevoegen' : 'Beheerder bewerken'">
            <template #left>
                <BackButton v-if="canPop" @click="pop" />
            </template>
            <template #right>
                <button v-if="!isNew" class="button text" @click="deleteMe">
                    <span class="icon trash" />
                    <span>Verwijderen</span>
                </button>
                <button v-if="!canPop" class="button icon close gray" @click="pop" />
            </template>
        </STNavigationBar>

        <main>
            <h1 v-if="isNew">
                Nieuwe beheerder toevoegen
            </h1>
            <h1 v-else>
                Beheerder bewerken
            </h1>

            <STErrorsDefault :error-box="errorBox" />

            <div class="split-inputs">
                <div>
                    <EmailInput v-model="email" title="Persoonlijk e-mailadres" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" />
                </div>

                <div>
                    <STInputBox title="Jouw naam" error-fields="firstName,lastName" :error-box="errorBox">
                        <div class="input-group">
                            <div>
                                <input v-model="firstName" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                            </div>
                            <div>
                                <input v-model="lastName" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                            </div>
                        </div>
                    </STInputBox>
                </div>
            </div>

            <Checkbox v-if="!isNew" v-model="changePassword">
                Wijzig wachtwoord
            </Checkbox>

            <div v-if="isNew || changePassword" class="split-inputs">
                <div>
                    <STInputBox title="Kies een persoonlijk wachtwoord" error-fields="password" :error-box="errorBox">
                        <input v-model="password" class="input" placeholder="Kies een wachtwoord" autocomplete="new-password" type="password" @input="password = $event.target.value" @change="password = $event.target.value">
                    </STInputBox>
                    <STInputBox title="Herhaal wachtwoord" error-fields="passwordRepeat" :error-box="errorBox">
                        <input v-model="passwordRepeat" class="input" placeholder="Herhaal nieuw wachtwoord" autocomplete="new-password" type="password" @input="passwordRepeat = $event.target.value" @change="passwordRepeat = $event.target.value">
                    </STInputBox>
                </div>

                <div>
                    <PasswordStrength v-model="password" />
                </div>
            </div>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" @click="cancel">
                    Annuleren
                </button>
                <LoadingButton :loading="saving">
                    <button class="button primary" @click="save">
                        Opslaan
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,CenteredMessage, Checkbox,EmailInput, ErrorBox, LoadingButton, PasswordStrength, PriceInput, STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { NewUser, User, Version } from '@stamhoofd/structures';
import { Component, Mixins,Prop } from "@simonbackx/vue-app-navigation/classes";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        PriceInput,
        LoadingButton,
        BackButton,
        STList,
        STListItem,
        Checkbox,
        EmailInput,
        PasswordStrength
    },
})
export default class EditUserView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    changePassword = false
    password = ""
    passwordRepeat = ""

    /**
     * Pass all the changes we made back when we save this category
     */
    @Prop({ required: true })
    saveHandler: ((patch: PatchableArrayAutoEncoder<NewUser>) => Promise<void>);

    @Prop({ required: true })
    user!: User

    patchUser: AutoEncoderPatchType<User> = User.patch({
        id: this.user.id
    })

    @Prop({ required: true })
    isNew: boolean

    get patchedUser() {
        return this.user.patch(this.patchUser)
    }

    // Saving

    async save() {
        if (this.saving) {
            return
        }

        const valid = await this.validator.validate()

        if (!valid) {
            return;
        }
        this.saving = true

        this.errorBox = null

        try {
            const arr: PatchableArrayAutoEncoder<NewUser> = new PatchableArray()
            if (this.isNew || this.changePassword) {
                // This takes a while ;)                
                if (this.isNew) {
                    arr.addPut(NewUser.create({
                        email: this.patchedUser.email,
                        firstName: this.patchedUser.firstName,
                        lastName: this.patchedUser.lastName,
                        permissions: this.patchedUser.permissions,
                        password: this.password
                    }))
                } else {
                    arr.addPatch(NewUser.patch({
                        id: this.patchedUser.id,
                        email: this.patchUser.email,
                        firstName: this.patchUser.firstName,
                        lastName: this.patchUser.lastName,
                        permissions: this.patchUser.permissions,
                        password: this.password
                    }))
                }
            } else {
                arr.addPatch(NewUser.patch({
                    id: this.patchedUser.id,
                    email: this.patchUser.email,
                    firstName: this.patchUser.firstName,
                    lastName: this.patchUser.lastName,
                    permissions: this.patchUser.permissions,
                }))
            }

            await this.saveHandler(arr)
            this.pop({ force: true })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }

    async deleteMe() {
        if (this.saving) {
            return
        }

        if (!await CenteredMessage.confirm("Ben je zeker dat je deze beheerder wilt verwijderen?", "Verwijderen")) {
            return
        }
        const arr: PatchableArrayAutoEncoder<NewUser> = new PatchableArray()
        arr.addDelete(this.user.id)

        this.errorBox = null
        this.saving = true

        try {
            await this.saveHandler(arr)
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false

        this.pop({ force: true })
    }

    cancel() {
        this.pop()
    }

    isChanged() {
        return patchContainsChanges(this.patchUser, this.user, { version: Version }) || this.changePassword || !!this.password
    }

    async shouldNavigateAway() {
        if (!this.isChanged()) {
            return true
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    get email() {
        return this.patchedUser.email
    }

    set email(email: string) {
        this.patchUser = this.patchUser.patch({
            email
        })
    }

    get firstName() {
        return this.patchedUser.firstName ?? ""
    }

    set firstName(firstName: string) {
        this.patchUser = this.patchUser.patch({
            firstName: firstName ? firstName : null
        })
    }

    get lastName() {
        return this.patchedUser.lastName ?? ""
    }

    set lastName(lastName: string) {
        this.patchUser = this.patchUser.patch({
            lastName: lastName ? lastName : null
        })
    }


   
}
</script>
