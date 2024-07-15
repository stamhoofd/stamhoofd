<template>
    <LoadingView v-if="loading" :error-box="errors.errorBox" />
    <SaveView v-else :title="viewTitle" @save="save" :loading="saving" :save-text="onSelect ? 'Sluiten' : 'Opslaan'">
        <h1>{{ viewTitle }}</h1>
        <SegmentedControl v-if="tabItems.length > 1" v-model="tab" :items="tabItems.map(i => i.id)" :labels="tabItems.map(i => i.label)" />

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList v-if="editableList.length">
            <STListItem v-for="emailTemplate in editableList" :key="emailTemplate.type + ':' + emailTemplate.id" :selectable="true" class="right-stack" @click="doSelectItem(emailTemplate)">
                
                <h2 class="style-title-list">
                    {{ EmailTemplate.isSavedEmail(emailTemplate.type) ? emailTemplate.subject : EmailTemplate.getTypeTitle(emailTemplate.type) }}
                </h2>
                <p v-if="!EmailTemplate.isSavedEmail(emailTemplate.type) && emailTemplate.subject" class="style-description-small">
                    "{{ emailTemplate.subject }}"
                </p>

                <p class="style-description-small">
                    {{ (!organization ? EmailTemplate.getPlatformTypeDescription(emailTemplate.type) : null) ?? EmailTemplate.getTypeDescription(emailTemplate.type) }}
                </p>

                <p class="style-description-small" v-if="!organization && EmailTemplate.allowOrganizationLevel(emailTemplate.type)">
                    Een lokale groep kan deze template aanpassen. Deze template wordt gebruikt als er geen lokale template is.
                </p>

                <p class="style-description-small">
                    <span v-if="!emailTemplate.id && organization && emailTemplate.html" class="style-tag">Standaard</span>
                    <span v-else-if="!emailTemplate.id" class="style-tag warn">Ontbreekt</span>
                    <span v-else>Laatst gewijzigd op {{ formatDateTime(emailTemplate.updatedAt) }}</span>
                </p>

                <template #right>
                    <button v-if="emailTemplate.id" class="button icon trash gray" type="button" @click.stop="deleteEmail(emailTemplate)" />
                    <button class="button icon edit gray" type="button" @click.stop="editEmail(emailTemplate)" />
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>

        <p v-else class="info-box">
            Geen emailtemplates gevonden
        </p>

        <p v-if="tab === 'userGenerated' && createOption">
            <button class="button text" type="button" @click="addCreateOption">
                <span class="icon download" />
                <span>Huidige opslaan als template</span>
            </button>
        </p>

        <p v-if="tab === 'userGenerated'">
            <button class="button text" type="button" @click="addTemplate">
                <span class="icon add" />
                <span>Nieuwe template</span>
            </button>
        </p>
    </SaveView>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, Decoder, deepSetArray, PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, SegmentedControl, useContext, useErrors, useOrganization, usePatchArray } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { EmailTemplate, EmailTemplateType } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";
import { Ref, computed, ref } from 'vue';
import EditEmailTemplateView from './EditEmailTemplateView.vue';
import { Sorter } from '@stamhoofd/utility';
import { useTranslate } from '@stamhoofd/frontend-i18n';

const props = withDefaults(
    defineProps<{
        types: EmailTemplateType[];
        groupId?: string|null;
        webshopId?: string|null;
        onSelect?: ((template: EmailTemplate) => boolean|Promise<boolean>) | null;
        createOption?: EmailTemplate|null;
        allowEditGenerated?: boolean;
    }>(), {
        groupId: null,
        webshopId: null,
        types: () => [...Object.values(EmailTemplateType)],
        onSelect: null,
        createOption: null,
        allowEditGenerated: true
    })

const viewTitle = computed(() => props.onSelect ? 'Kies een emailtemplate' : 'Wijzig automatische e-mails');
const templates = ref([]) as Ref<EmailTemplate[]>
const errors = useErrors();
const {patched, addPatch, addPut, addDelete, patch, hasChanges} = usePatchArray(templates);
const owner = useRequestOwner()
const context = useContext();
const loading = ref(true);
const organization = useOrganization();
const present = usePresent();
const pop = usePop();
const saving = ref(false);
const $t = useTranslate();
loadTemplates().catch(console.error);

const tabItems = props.onSelect ? [
    {
        id: 'userGenerated',
        label: 'Opgeslagen'
    }
] : (
        props.allowEditGenerated ? [
            {
                id: 'auto',
                label: 'Automatische'
            },
            {
                id: 'userGenerated',
                label: 'Opgeslagen'
            },
        ] : [
            {
                id: 'auto',
                label: 'Automatische'
            }
        ]
    );

const tab = ref(tabItems[0].id);

const editableList = computed(() => {
    // All user generated
    if (tab.value === 'userGenerated') {
        return patched.value.filter(t => EmailTemplate.isSavedEmail(t.type)).sort((a, b) => Sorter.byDateValue(a.updatedAt, b.updatedAt));
    }

    // All auto
    const org = organization.value;
    const base = patched.value.filter(t => !EmailTemplate.isSavedEmail(t.type) && props.types.includes(t.type) && (!org || t.organizationId === org.id));

    // Create missing ones
    for (const type of props.types) {
        if (EmailTemplate.isSavedEmail(type)) {
            continue;
        }
        if (!base.find(t => t.type === type)) {
            let defaultTemplate: EmailTemplate | null = patched.value.find(template => template.type === type && template.groupId === null && template.webshopId === null && template.organizationId === null) ?? null;

            if (org) {
                defaultTemplate = patched.value.find(template => template.type === type && template.groupId === null && template.webshopId === null && template.organizationId === org.id) ?? defaultTemplate ?? null;
            }
            
            base.push(
                EmailTemplate.create({
                    ...defaultTemplate,
                    id: '', // clear
                    organizationId: organization.value?.id ?? null,
                    groupId: props.groupId,
                    webshopId: props.webshopId,
                    type
                })
            );
        }
    }

    // Now order by type
    base.sort((a, b) => a.type.localeCompare(b.type));

    return base;
})

async function editEmail(emailTemplate: EmailTemplate) {
    await present({
        components: [
            new ComponentWithProperties(EditEmailTemplateView, {
                emailTemplate,
                isNew: !emailTemplate.id,
                saveHandler: async (patch: AutoEncoderPatchType<EmailTemplate>) => {
                    if (emailTemplate.id) {
                        // Update
                        patch.id = emailTemplate.id;
                        patch.updatedAt = new Date();
                        addPatch(patch);
                    } else {
                        // Create
                        const toCreate = emailTemplate.patch(patch);
                        toCreate.id = uuidv4();
                        addPut(toCreate);
                    }

                    if (props.onSelect) {
                        await saveWithoutDismiss()
                    }
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}

async function addTemplate() {
    const template = EmailTemplate.create({
        id: '',
        type: EmailTemplateType.SavedMembersEmail,
    })
    await editEmail(template)
}

async function addCreateOption() {
    if (!props.createOption) {
        return;
    }
    await editEmail(props.createOption)
}

async function deleteEmail(emailTemplate: EmailTemplate) {
    if (emailTemplate.id) {
        if (!await CenteredMessage.confirm('Weet je zeker dat je deze email template wilt verwijderen?', 'Verwijderen')) {
            return;
        }
        addDelete(emailTemplate.id);

        if (props.onSelect) {
            await saveWithoutDismiss()
        }
    }
}

async function loadTemplates() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: "GET",
            path: "/email-templates",
            query: { 
                groupId: props.groupId,
                webshopId: props.webshopId
            },
            shouldRetry: true,
            owner,
            decoder: new ArrayDecoder(EmailTemplate as Decoder<EmailTemplate>)
        })
        templates.value = response.data
        loading.value = false
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }
    
}

async function doSelectItem(item: EmailTemplate) {
    if (props.onSelect) {
        if (await saveWithoutDismiss()) {
            if (await props.onSelect(item)) {
                await pop({force: true})
            }
        }
    } else {
        await editEmail(item)
    }
    
}
async function saveWithoutDismiss() {
    if (saving.value) {
        return false;
    }

    if (patch.value.changes.length === 0) {
        return true;
    }

    saving.value = true;
    try {
        const response = await context.value.authenticatedServer.request({
            method: "PATCH",
            path: "/email-templates",
            shouldRetry: false,
            owner,
            body: patch.value,
            decoder: new ArrayDecoder(EmailTemplate as Decoder<EmailTemplate>)
        })

        deepSetArray(templates.value, response.data, {keepMissing: true})

        await loadTemplates()
        patch.value = new PatchableArray()
        saving.value = false
        
        return true;
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }
    saving.value = false
    return false;
}


async function save() {
    if (await saveWithoutDismiss()) {
        await pop({force: true})
    }
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('shared.save.shouldNavigateAway.title'), $t('shared.save.shouldNavigateAway.confirm'))
}

defineExpose({
    shouldNavigateAway
})
</script>
