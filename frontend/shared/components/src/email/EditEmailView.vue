<template>
    <SaveView :loading="saving" title="E-mailadres" :disabled="!hasChangesFull" @save="save">
        <h1 v-if="isNew">
            E-mailadres toevoegen
        </h1>
        <h1 v-else>
            E-mailadres bewerken
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox title="Naam / aanspreking (optioneel)" error-fields="name" :error-box="errors.errorBox">
            <input
                ref="firstInput"
                v-model="name"
                class="input"
                type="text"
                placeholder="Optioneel. bv. Webshopverantwoordelijke"
                autocomplete=""
            >
        </STInputBox>

        <EmailInput v-model="emailAddress" title="E-mailadres" :validator="errors.validator" placeholder="E-mailadres waarmee je wilt versturen" />

        <Checkbox v-model="isDefault">
            <h3 class="style-title-list">
                Standaard e-mailadres
            </h3>
            <p class="style-description-small">
                Voor algemene e-mails of voor antwoorden op automatische e-mails als domeinnaam niet ingesteld is (bv. als antwoord op bestelbevestiging).
            </p>
        </Checkbox>

        <template v-if="enableMemberModule && groups.length">
            <hr>
            <h2>Inschrijvingsgroepen</h2>
            <p class="st-list-description">
                Selecteer de groepen die standaard met dit e-mailadres moeten versturen.
            </p>

            <STList>
                <STListItem v-for="group in groups" :key="group.group.id" element-name="label" :selectable="true">
                    <template #left>
                        <Checkbox v-model="group.selected" />
                    </template>
                    <h3 class="style-title-list">
                        {{ group.group.settings.name }}<h3 />
                    </h3>
                </STListItem>
            </STList>
        </template>

        <template v-if="enableWebshopModule && webshops.length">
            <hr>
            <h2>Webshops</h2>
            <p class="st-list-description">
                Selecteer de webshops waarvoor we dit e-mailadres moeten gebruiken (bv. bestelbevestiging).
            </p>

            <STList>
                <STListItem v-for="webshop in webshops" :key="webshop.webshop.id" element-name="label" :selectable="true">
                    <template #left>
                        <Checkbox v-model="webshop.selected" />
                    </template>
                    <h3 class="style-title-list">
                        {{ webshop.webshop.meta.name }}<h3 />
                    </h3>
                </STListItem>
            </STList>
        </template>

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                Verwijderen
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArray } from "@simonbackx/simple-encoding";
import { usePop } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, EmailInput, ErrorBox, SaveView, STErrorsDefault, STInputBox, STList, STListItem, useErrors, useOrganization, usePatchArray, usePlatform } from "@stamhoofd/components";
import { useTranslate } from "@stamhoofd/frontend-i18n";
import { useOrganizationManager, usePlatformManager, useRequestOwner } from "@stamhoofd/networking";
import { Group, GroupPrivateSettings, OrganizationEmail, OrganizationPrivateMetaData, OrganizationRegistrationPeriod, Platform, PlatformPrivateConfig, WebshopPreview, WebshopPrivateMetaData } from "@stamhoofd/structures";
import { computed, onMounted, Ref, ref } from 'vue';

const props = defineProps<{
    email: OrganizationEmail;
    isNew: boolean;
}>()

const saving = ref(false)
const errors = useErrors() 
const groups = ref([]) as Ref<SelectableGroup[]>
const webshops = ref([]) as Ref<SelectableWebshop[]>
const organization = useOrganization()
const platform = usePlatform()
const originalArray = computed(() => (organization.value ? organization.value.privateMeta?.emails : platform.value.privateConfig?.emails) ?? [])
const {patched: patchedArray, patch, hasChanges, addPatch: addAPatch, addPut} = usePatchArray(originalArray)
const patched = computed(() => patchedArray.value.find(e => e.id === props.email.id) ?? props.email)
const addPatch = (patch: PartialWithoutMethods<AutoEncoderPatchType<OrganizationEmail>>) => addAPatch(OrganizationEmail.patch({ id: props.email.id, ...patch }))
const organizationManager = useOrganizationManager()
const owner = useRequestOwner()
const pop = usePop();
const platformManager = usePlatformManager();
const $t = useTranslate();
const name = computed({
    get: () => patched.value.name,
    set: (name) => addPatch({ name })
})

const emailAddress = computed({
    get: () => patched.value.email,
    set: (email) => addPatch({ email })
})

const isDefault = computed({
    get: () => patched.value.default,
    set: (d) => {
        addPatch({ default: d })

        // Remove other defaults
        if (d) {
            for (const email of patchedArray.value) {
                if (email.id !== props.email.id && email.default) {
                    addAPatch(OrganizationEmail.patch({ id: email.id, default: false }))
                }
            }
        } else {
            // Remove changes to default
            for (const email of patchedArray.value) {
                if (email.id !== props.email.id && email.default === false) {
                    const originalValue = originalArray.value.find(e => e.id === email.id)
                    if (originalValue && originalValue.default) {
                        addAPatch(OrganizationEmail.patch({ id: email.id, default: true }))
                    }
                }
            }
        }
    }
})

onMounted(() => {
    if (props.isNew) {
        addPut(props.email)
    }

    if (organization.value) {
        for (const group of organization.value.period.groups) {
            groups.value.push(new SelectableGroup(group, group.privateSettings !== null && group.privateSettings.defaultEmailId !== null && group.privateSettings.defaultEmailId === props.email.id))
        }

        for (const webshop of organization.value.webshops) {
            webshops.value.push(new SelectableWebshop(webshop, webshop.privateMeta !== null && webshop.privateMeta.defaultEmailId !== null && webshop.privateMeta.defaultEmailId === props.email.id))
        }
    }
})

const enableMemberModule = computed(() => {
    return organization.value?.meta.modules.useMembers ?? false
})

const enableWebshopModule = computed(() => {
    return organization.value?.meta.modules.useWebshops ?? false
})

class SelectableGroup {
    group: Group;
    selected = false;
    constructor(group: Group, selected = false) {
        this.selected = selected
        this.group = group
    }
}

class SelectableWebshop {
    webshop: WebshopPreview;
    selected = false;
    constructor(webshop: WebshopPreview, selected = false) {
        this.selected = selected
        this.webshop = webshop
    }
}

async function deleteMe() {
    // todo
}

async function save() {
    if (saving.value) {
        return;
    }
    saving.value = true

    if (!await errors.validator.validate()) {
        saving.value = false
        return;
    }
    try {
        if (organization.value) {
            // First save emails
            const organizationPatch = organizationManager.value.getPatch().patch({
                privateMeta: OrganizationPrivateMetaData.patch({
                    emails: patch.value
                })
            })

            for (const webshop of webshops.value) {
                // Check if changed
                const prev = webshop.webshop.privateMeta !== null && webshop.webshop.privateMeta.defaultEmailId !== null && webshop.webshop.privateMeta.defaultEmailId === props.email.id
                if (prev != webshop.selected) {
                    organizationPatch.webshops.addPatch(WebshopPreview.patch({
                        id: webshop.webshop.id,
                        privateMeta: WebshopPrivateMetaData.patch({
                            defaultEmailId: webshop.selected ? props.email.id : null,
                        })
                    }))
                }
            }

            // Save
            await organizationManager.value.patch(organizationPatch, {owner, shouldRetry: false})

            // Clear patch
            patch.value = new PatchableArray()

            // Save period
            let shouldSavePeriod = false
            const organizationPeriodPatch = OrganizationRegistrationPeriod.patch({ id: organization.value?.period.id })
            for (const group of groups.value) {
                // Check if changed
                const prev = group.group.privateSettings !== null && group.group.privateSettings.defaultEmailId !== null && group.group.privateSettings.defaultEmailId === props.email.id
                if (prev != group.selected) {
                    organizationPeriodPatch.groups.addPatch(Group.patch({
                        id: group.group.id,
                        privateSettings: GroupPrivateSettings.patch({
                            defaultEmailId: group.selected ? props.email.id : null,
                        })
                    }))
                    shouldSavePeriod = true
                }
            }

            if (shouldSavePeriod) {
                await organizationManager.value.patchPeriod(organizationPeriodPatch, {owner, shouldRetry: false})
            }
        } else {
            await platformManager.value.patch(Platform.patch({
                privateConfig: PlatformPrivateConfig.patch({
                    emails: patch.value
                })
            }))
        }
   
        await pop({ force: true })
        saving.value = false
    } catch (e) {
        console.error(e)
        errors.errorBox = new ErrorBox(e)
        saving.value = false
    }
}

const hasChangesFull = computed(() => {
    if (!hasChanges.value) {
        let otherChanges = false;
        for (const group of groups.value) {
            // Check if changed
            const prev = group.group.privateSettings !== null && group.group.privateSettings.defaultEmailId !== null && group.group.privateSettings.defaultEmailId === props.email.id
            if (prev != group.selected) {
                otherChanges = true
                break
            }
        }

        for (const webshop of webshops.value) {
            // Check if changed
            const prev = webshop.webshop.privateMeta !== null && webshop.webshop.privateMeta.defaultEmailId !== null && webshop.webshop.privateMeta.defaultEmailId === props.email.id
            if (prev != webshop.selected) {
                otherChanges = true
                break
            }
        }

        return otherChanges;
    }

    return true
})

const shouldNavigateAway = async () => {
    if (!hasChangesFull.value) {
        return true
    }
    return await CenteredMessage.confirm($t('shared.save.shouldNavigateAway.title'), $t('shared.save.shouldNavigateAway.confirm'))
}

defineExpose({
    shouldNavigateAway
})

</script>
