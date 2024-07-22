<template>
    <SaveView :loading="saving" :title="isNew ? 'Nieuwe beheerder' : user.name" :disabled="!isNew && !hasChanges" @save="save">
        <template v-if="!getPermissions(user)">
            <h1 v-if="isNew">
                Account toevoegen
            </h1>
            <h1 v-else>
                Account bewerken
            </h1>
        </template>
        <template v-else>
            <h1 v-if="isNew">
                Externe beheerder toevoegen
            </h1>
            <h1 v-else-if="!user.memberId">
                Externe beheerder bewerken
            </h1>
            <h1 v-else>
                Interne beheerder bewerken
            </h1>
        </template>

        <LoadingButton v-if="getPermissions(user) && !isNew && !user.hasAccount" :loading="sendingInvite">
            <button class="warning-box with-button" type="button" :class="{selectable: !didSendInvite}" @click="resendInvite">
                Deze beheerder heeft nog geen account aangemaakt

                <span class="button text" :class="{disabled: didSendInvite}">
                    Uitnodiging opnieuw versturen
                </span>
            </button>
        </LoadingButton>

        <p v-if="getPermissions(user) && !user.memberId" class="info-box">
            Deze beheerder is niet gekoppeld aan een ingeschreven lid, en is daarom extern. Zorg dat het e-mailadres overeen komt met het e-mailadres van een lid zelf.
        </p> 

        <STErrorsDefault :error-box="$errors.errorBox" />
        <STInputBox title="Naam" error-fields="firstName,lastName" :error-box="$errors.errorBox">
            <div class="input-group">
                <div>
                    <input v-model="firstName" enterkeyhint="next" class="input" type="text" placeholder="Voornaam" autocomplete="given-name" :disabled="!canEditDetails">
                </div>
                <div>
                    <input v-model="lastName" enterkeyhint="next" class="input" type="text" placeholder="Achternaam" autocomplete="family-name" :disabled="!canEditDetails">
                </div>
            </div>
        </STInputBox>

        <EmailInput v-model="email" title="E-mailadres" :validator="$errors.validator" placeholder="E-mailadres" :required="true" :disabled="!canEditDetails" />

        <template v-if="getPermissions(user)">
            <div v-if="!user.memberId || (getPermissions(user) && !!getPermissions(user)!.roles.find(r => !(r instanceof PermissionRoleForResponsibility)))" class="container">
                <hr>
                <h2>Externe beheerdersrollen</h2>
                <p>Je kan externe beheerders verschillende rollen toekennen (alternatief voor functies die je aan leden kan koppelen). Een externe beheerder zonder rollen heeft geen enkele toegang.</p>

                <EditUserPermissionsBox :user="patched" @patch:user="(event) => addPatch(event)" />
            </div>

            <div v-if="resources.length" class="container">
                <hr>
                <h2>Individuele toegang</h2>
                <p>Beheerders kunnen automatisch toegang krijgen tot een onderdeel als ze het zelf hebben aangemaakt maar anders niet automatisch toegang zouden hebben (bv. aanmaken van nieuwe webshops). Sowieso is het aan te raden om dit om te zetten in beheerdersrollen, aangezien die eenvoudiger te beheren zijn.</p>

                <STList>
                    <ResourcePermissionRow 
                        v-for="resource in resources" 
                        :key="resource.id" 
                        :role="permissions.unloadedPermissions" 
                        :resource="resource" 
                        :configurable-access-rights="[]"
                        type="resource" 
                        @patch:role="addPermissionPatch" 
                    />
                </STList>
            </div>
        </template>
        <p v-else class="style-description-small">
            Dit account is geen beheerder.
        </p>

        <template v-if="!isNew && getPermissions(user)">
            <hr v-if="!isNew">
            <h2>
                Verwijderen
            </h2>
            <p>Je kan een beheerder verwijderen. Het account blijft dan behouden maar de beheerder verliest alle toegangsrechten.</p>

            <button class="button secundary danger" type="button" @click="doDelete()">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
        </template>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, EditUserPermissionsBox, EmailInput, ErrorBox, SaveView, Toast, useContext, useErrors, usePatch, useUninheritedPermissions } from '@stamhoofd/components';
import { PermissionRoleForResponsibility, Permissions, PermissionsResourceType, User, UserWithMembers } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

import ResourcePermissionRow from './components/ResourcePermissionRow.vue';
import { useAdmins } from './hooks/useAdmins';

const $errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const didSendInvite = ref(false);
const sendingInvite = ref(false);
const $context = useContext()
const pop = usePop();

const props = defineProps<{
    user: UserWithMembers;
    isNew: boolean;
}>();

const {patch, patched, addPatch, hasChanges} = usePatch(props.user)
const {pushInMemory, dropFromMemory, getPermissionsPatch, getPermissions} = useAdmins()
const permissions = useUninheritedPermissions({patchedUser: patched})
const resources = computed(() => {
    const raw = permissions.unloadedPermissions;
    if (!raw) {
        return [];
    }
    const list: {id: string, name: string, type: PermissionsResourceType}[] = [];
    for (const [type, p] of raw.resources.entries()) {
        for (const [id, resource] of p.entries()) {
            list.push({id, name: resource.resourceName, type})
        }
    }
    return list;
})

const canEditDetails = computed(() => {
    return !patched.value?.permissions?.globalPermissions || $context.value.auth.hasFullPlatformAccess() || (patched.value.id === $context.value?.user?.id)
});

const addPermissionPatch = (patch: AutoEncoderPatchType<Permissions>) => {
    addPatch(User.patch({
        permissions: getPermissionsPatch(patched.value, patch)
    }))
}

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
        $errors.errorBox = new ErrorBox(errors)
    } else {
        $errors.errorBox = null
        valid = true
    }
    valid = valid && await $errors.validator.validate()

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
                decoder: UserWithMembers as Decoder<UserWithMembers>
            })
            user = response.data;
            new Toast("Beheerder "+user.firstName+" is toegevoegd en heeft een uitnodiging via email ontvangen.", "success").setHide(5000).show()
        } else {
            const response = await $context.value.authenticatedServer.request({
                method: "PATCH",
                path: "/user/"+patched.value.id,
                body: patch.value,
                decoder: UserWithMembers as Decoder<UserWithMembers>
            })
            user = response.data;
            new Toast("Beheerder "+user.firstName+" is aangepast", "success").setHide(2000).show()
        }

        // Copy all data
        props.user.deepSet(user);

        // Push user to admins
        if (props.isNew) {
            pushInMemory(props.user)
        }

        await pop({ force: true })
    } catch (e) {
        console.error(e)
        $errors.errorBox = new ErrorBox(e)
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
        const response = await $context.value.authenticatedServer.request({
            method: "PATCH",
            path: "/user/"+props.user.id,
            body: User.patch({
                id: props.user.id,
                permissions: getPermissionsPatch(props.user, null)
            }),
            decoder: User as Decoder<User>
        })

        // Copy all data
        props.user.deepSet(response.data);
        dropFromMemory(props.user)

        await pop({ force: true })

        new Toast("Beheerder "+props.user.firstName+" is verwijderd", "success").setHide(2000).show()
    } catch (e) {
        console.error(e)
        $errors.errorBox = new ErrorBox(e)
        deleting.value = false;
    }
    return false;
};
const resendInvite = async () => {
    // We can send a new invite by just recreating the admin (the API will merge with existing admins)
    if (hasChanges.value || props.isNew) {
        new CenteredMessage('Wijzigingen niet opgeslagen', 'Voor je een uitnodiging opnieuw kan versturen moet je alle wijzigingen opslaan of annuleren.').addCloseButton().show()
        return
    }
    if (sendingInvite.value) {
        return;
    }
    sendingInvite.value = true

    try {

        // Note: we don't use the patchedUser, because that would save any changes too
        const response = await $context.value.authenticatedServer.request({
            method: "POST",
            path: "/user",
            body: props.user,
            decoder: User as Decoder<User>
        })
        
        // Copy all data
        props.user.set(response.data);
        didSendInvite.value = true

        new Toast("Uitnodiging verzonden naar "+props.user.email, "success").setHide(2000).show()
    } catch (e) {
        console.error(e)
        $errors.errorBox = new ErrorBox(e)
        
    }
    sendingInvite.value = false
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
