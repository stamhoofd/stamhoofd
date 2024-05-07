<template>
    <SaveView :loading="saving" :title="isNew ? 'Nieuwe beheerder' : user.name" :disabled="!isNew && !hasChanges" @save="save">
        <h1 v-if="isNew">
            Beheerder toevoegen
        </h1>
        <h1 v-else>
            Beheerder bewerken
        </h1>

        <button v-if="!isNew && !user.hasAccount" class="warning-box with-button" type="button" :class="{selectable: !didSendInvite}" @click="resendInvite">
            Deze beheerder heeft nog geen account aangemaakt

            <span class="button text" :class="{disabled: didSendInvite}">
                Uitnodiging opnieuw versturen
            </span>
        </button>

        <STErrorsDefault :error-box="errorBox" />
        <STInputBox title="Naam" error-fields="firstName,lastName" :error-box="errorBox">
            <div class="input-group">
                <div>
                    <input v-model="firstName" enterkeyhint="next" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                </div>
                <div>
                    <input v-model="lastName" enterkeyhint="next" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                </div>
            </div>
        </STInputBox>

        <EmailInput v-model="email" title="E-mailadres" :validator="validator" placeholder="E-mailadres" :required="true" />

        <div class="container">
            <hr>
            <h2>Rollen</h2>
            <p>Je kan beheerders verschillende rollen toekennen. Een beheerder zonder rollen heeft geen enkele toegang.</p>

            <EditUserPermissionsBox :user="patched" @patch:user="(event) => addPatch(event)" />
        </div>

        <hr v-if="!isNew">
        <h2 v-if="!isNew">
            Verwijderen
        </h2>

        <button v-if="!isNew" class="button secundary danger" type="button" @click="doDelete()">
            <span class="icon trash" />
            <span>Verwijderen</span>
        </button>
    </SaveView>
</template>

<script setup lang="ts">
import { useErrors, usePatch, EmailInput, SaveView, CenteredMessage, ErrorBox, useContext, Toast, usePermissions } from '@stamhoofd/components';
import { User, UserPermissions } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import EditUserPermissionsBox from './components/EditUserPermissionsBox.vue'
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Decoder } from '@simonbackx/simple-encoding';
import { useAdmins } from './hooks/useAdmins';
import { usePop } from '@simonbackx/vue-app-navigation';

const {errorBox, validator} = useErrors();
const saving = ref(false);
const deleting = ref(false);
const didSendInvite = ref(false);
const $context = useContext()
const pop = usePop();

const props = defineProps<{
    user: User;
    isNew: boolean;
}>();

const {patch, patched, addPatch, hasChanges} = usePatch(props.user)
const {pushInMemory} = useAdmins()
const permissions = usePermissions({patchedUser: patched})

const save = async () => {
    if (deleting.value || saving.value) {
        return;
    }

    saving.value = true

    const errors = new SimpleErrors()

    if ((firstName.value?.length ?? 0) < 2) {
        errors.addError(new SimpleError({
            code: "invalid_field",
            message: "Vul de voornaam in",
            field: "firstName"
        }))
    }
    if ((lastName.value?.length ?? 0) < 2) {
        errors.addError(new SimpleError({
            code: "invalid_field",
            message: "Vul de achternaam in",
            field: "lastName"
        }))
    }
    
    let valid = false

    if (errors.errors.length > 0) {
        errorBox.value = new ErrorBox(errors)
    } else {
        errorBox.value = null
        valid = true
    }
    valid = valid && await validator.validate()

    // TODO: validate if at least email or name is filled in

    if (!valid) {
        saving.value = false
        return;
    }

    try {
        let user: User;
        if (props.isNew) {
            const response = await $context.value.authenticatedServer.request({
                method: "POST",
                path: "/user",
                body: patched.value,
                decoder: User as Decoder<User>
            })
            user = response.data;
            new Toast("Beheerder "+user.firstName+" is toegevoegd en heeft een uitnodiging via email ontvangen.", "success").setHide(5000).show()
        } else {
            const response = await $context.value.authenticatedServer.request({
                method: "PATCH",
                path: "/user/"+patched.value.id,
                body: patch.value,
                decoder: User as Decoder<User>
            })
            user = response.data;
            new Toast("Beheerder "+user.firstName+" is aangepast", "success").setHide(2000).show()
        }

        // Copy all data
        props.user.set(user);

        // Push user to admins
        if (props.isNew) {
            pushInMemory(props.user)
        }

        pop({ force: true })
    } catch (e) {
        console.error(e)
        errorBox.value = new ErrorBox(e)
        saving.value = false
    }
}
const doDelete = async () => {
    if (deleting.value || saving.value) {
        return false;
    }
    
    if (props.isNew) {
        return false;
    }

    if (!await CenteredMessage.confirm("Ben je zeker dat je deze beheerder wilt verwijderen?", "Verwijderen")) {
        return false;
    }

    deleting.value = true;

    try {
        // Patch the user
        await $context.value.authenticatedServer.request({
            method: "PATCH",
            path: "/user/"+props.user.id,
            body: User.patch({
                id: props.user.id,
                permissions: permissions.createPatch(null)
            }),
            decoder: User as Decoder<User>
        })

        pop({ force: true })

        new Toast("Beheerder "+props.user.firstName+" is verwijderd", "success").setHide(2000).show()
    } catch (e) {
        console.error(e)
        errorBox.value = new ErrorBox(e)
        deleting.value = false;
    }
    return false;
};
const resendInvite = async () => {
    // todo
    didSendInvite.value = true;
};

const firstName = computed({
    get: () => patched.value.firstName,
    set: (value: string|null) => addPatch({firstName: value}),
});

const lastName = computed({
    get: () => patched.value.lastName,
    set: (value: string|null) => addPatch({lastName: value}),
});

const email = computed({
    get: () => patched.value.email,
    set: (value: string) => addPatch({email: value}),
});

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
}

defineExpose({
    shouldNavigateAway
})
</script>