<template>
    <div id="account-view" class="st-view">
        <STNavigationBar title="Mijn account" />

        <main class="center">
            <h1>
                Mijn account
            </h1>
            <p>Met een account kan je één of meerdere leden beheren.</p>

            <p v-if="isUserModeOrganization && patched.organizationId === null" class="error-box icon privacy">
                Dit is een platform account
            </p>
        
            <STErrorsDefault :error-box="errors.errorBox" />

            <form @submit.prevent="save">
                <STInputBox title="Mijn naam" error-fields="firstName,lastName" :error-box="errors.errorBox">
                    <div class="input-group">
                        <div>
                            <input v-model="firstName" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                        </div>
                        <div>
                            <input v-model="lastName" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                        </div>
                    </div>
                </STInputBox>

                <EmailInput v-model="email" title="E-mailadres" :validator="errors.validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="email" />

                <div class="style-button-bar">
                    <LoadingButton :loading="saving">
                        <button id="submit" class="button primary" type="submit" :disabled="!hasChanges">
                            <span>Opslaan</span>
                        </button>
                    </LoadingButton>
                </div>
            </form>

            <hr>

            <STList>
                <STListItem :selectable="true" @click.prevent="openChangePassword">
                    <template #left>
                        <span class="icon key" />
                    </template>

                    <h3 class="style-title-list">
                        Wachtwoord wijzigen
                    </h3>
                </STListItem>

                <STListItem :selectable="true" @click.prevent="logout">
                    <template #left>
                        <span class="icon logout" />
                    </template>

                    <h3 class="style-title-list">
                        Uitloggen
                    </h3>
                </STListItem>

                <STListItem :selectable="true" @click.prevent="deleteRequest">
                    <template #left>
                        <LoadingButton>
                            <span class="icon trash red" />
                        </LoadingButton>
                    </template>


                    <h3 class="style-title-list red">
                        Account verwijderen
                    </h3>
                </STListItem>
            </STList>

            <template v-if="policies.length">
                <p class="style-button-bar">
                    <a v-for="policy of policies" :key="policy.id" class="button text" type="button" :href="policy.url" target="_blank">
                        <span>{{ policy.name }}</span>
                    </a>
                </p>
            </template>
        </main>
    </div>
</template>

<script lang="ts" setup>
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, useDismiss, usePop, usePresent } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ChangePasswordView, ConfirmEmailView, EmailInput, ErrorBox, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, Toast, useContext, useErrors, usePatch, usePlatform, useUser, useValidation } from "@stamhoofd/components";
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { LoginHelper } from '@stamhoofd/networking';
import { computed, onMounted, ref } from 'vue';
import DeleteView from './DeleteView.vue';

const $context = useContext();
const $platform = usePlatform();
const $user = useUser();
const errors = useErrors();
const present = usePresent();
const dismiss = useDismiss();
const pop = usePop();
const $t = useTranslate();
const {patched, addPatch, hasChanges, patch} = usePatch($user.value!);


const isUserModeOrganization = STAMHOOFD.userMode === 'organization';
const saving = ref(false);
const policies = computed(() => $platform.value.config.privacy.policies)

onMounted(() => {
    $context.value.fetchUser(false).catch(console.error)
})

const email = computed({
    get: () => patched.value.email,
    set: (email) => {
        addPatch({email});
    }
})

const firstName = computed({
    get: () => patched.value.firstName,
    set: (firstName) => {
        addPatch({firstName});
    }
})

const lastName = computed({
    get: () => patched.value.lastName,
    set: (lastName) => {
        addPatch({lastName});
    }
})

useValidation(errors.validator, () => {
    const se = new SimpleErrors();

    if (se.errors.length > 0) {
        errors.errorBox = new ErrorBox(se)
        return false
    }

    errors.errorBox = null;
    return true;
});

async function save() {
    if (saving.value) {
        return;
    }

    const isValid = await errors.validator.validate()

    if (!isValid) {
        return;
    }

    saving.value = true

    try {
        const result = await LoginHelper.patchUser($context.value, patch.value)

        if (result.verificationToken) {
            await present(new ComponentWithProperties(ConfirmEmailView, { token: result.verificationToken, email: patched.value.email }).setDisplayStyle("sheet"))
        } else {
            const toast = new Toast('De wijzigingen zijn opgeslagen', "success green")
            toast.show()
        }
        
        await dismiss({force: true});
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    } finally {
        saving.value = false
    }
}

async function  deleteRequest() {
    const user = $user.value;
    if(!user) {
        return;
    }

    const confirmationCode = user.email;

    await present({
        components: [
            new ComponentWithProperties(DeleteView, {
                title: 'Verwijder jouw account?',
                description: `Ben je 100% zeker dat je jouw account wilt verwijderen? Vul dan je huidige e-mailadres in ter bevestiging. Al jouw gegevens gaan verloren. Je kan dit niet ongedaan maken.`,
                confirmationTitle: 'Bevestig je e-mailadres',
                confirmationPlaceholder: 'Huidige e-mailadres',
                confirmationCode,
                checkboxText: 'Ja, ik ben 100% zeker',
                onDelete: async () => {
                    await $context.value.deleteAccount()

                    Toast.success("Je account is verwijderd. Het kan even duren voor jouw aanvraag volledig is verwerkt.").show()
                    await pop({force: true})
                    return true;
                }
            })
        ],
        modalDisplayStyle: "sheet"
    });
}

async function openChangePassword() {
    await present(new ComponentWithProperties(ChangePasswordView, {}).setDisplayStyle("sheet"))
}

async function logout() {
    if (await CenteredMessage.confirm("Ben je zeker dat je wilt uitloggen?", "Uitloggen")) {
        await $context.value.logout()
        await pop({force: true})
    }
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('2199906b-9125-4838-8ffc-3d88a47681d1'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'))
}

defineExpose({
    shouldNavigateAway
})
</script>
