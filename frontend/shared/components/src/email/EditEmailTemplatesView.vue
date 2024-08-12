<template>
    <LoadingView v-if="loading" :error-box="errors.errorBox" />
    <SaveView v-else :title="viewTitle" :loading="saving" :save-text="onSelect ? 'Sluiten' : 'Opslaan'" @save="save">
        <h1>{{ viewTitle }}</h1>
        <SegmentedControl v-if="tabItems.length > 1" v-model="tab" :items="tabItems.map(i => i.id)" :labels="tabItems.map(i => i.label)" />

        <STErrorsDefault :error-box="errors.errorBox" />

        <STList v-if="editableList.length">
            <STListItem v-for="emailTemplate in editableList" :key="emailTemplate.type + ':' + emailTemplate.id" :selectable="true" class="right-stack" @click="doSelectItem(emailTemplate)">
                <template #left>
                    <span v-if="EmailTemplate.isSavedEmail(emailTemplate.type)" class="icon email-template" />
                    <span v-else-if="!emailTemplate.id && emailTemplate.html" v-tooltip="'De standaard e-mail wordt gebruikt'" class="icon email" />
                    <span v-else-if="!emailTemplate.id" v-tooltip="'Niet actief'" class="icon help" />
                    <span v-else v-tooltip="'Aangepast vanaf standaard template'" class="icon layered">
                        <span class="icon email-edited-layer-1" />
                        <span class="icon email-edited-layer-2 primary" />
                    </span>
                </template>
                
                <p v-if="getTemplatePrefix(emailTemplate)" class="style-title-prefix-list">
                    {{ getTemplatePrefix(emailTemplate) }}
                </p>
                
                <h2 class="style-title-list">
                    {{ EmailTemplate.isSavedEmail(emailTemplate.type) ? emailTemplate.subject : EmailTemplate.getTypeTitle(emailTemplate.type) }}
                </h2>

                <p class="style-description-small">
                    {{ (!organization ? EmailTemplate.getPlatformTypeDescription(emailTemplate.type) : null) ?? EmailTemplate.getTypeDescription(emailTemplate.type) }}
                </p>

                <p v-if="!organization && EmailTemplate.allowOrganizationLevel(emailTemplate.type)" class="style-description-small">
                    Een lokale groep kan deze template aanpassen. Deze template wordt gebruikt als er geen lokale template is.
                </p>

                <p v-if="emailTemplate.id" class="style-description-small">
                    Laatst gewijzigd op {{ formatDateTime(emailTemplate.updatedAt) }}
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

        <hr v-if="tab === 'userGenerated'">

        <p v-if="tab === 'userGenerated' && createOption">
            <button class="button text" type="button" @click="addCreateOption">
                <span class="icon download" />
                <span>Huidige e-mail opslaan</span>
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
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, SegmentedControl, useAppContext, useContext, useErrors, useOrganization, usePatchArray } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { useRequestOwner } from '@stamhoofd/networking';
import { EmailTemplate, EmailTemplateType, Group } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";
import { computed, Ref, ref } from 'vue';
import EditEmailTemplateView from './EditEmailTemplateView.vue';

const props = withDefaults(
    defineProps<{
        types: EmailTemplateType[];
        groups: Group[]|null;
        webshopId?: string|null;
        onSelect?: ((template: EmailTemplate) => boolean|Promise<boolean>) | null;
        createOption?: EmailTemplate|null;
        allowEditGenerated?: boolean;
    }>(), {
        groups: null,
        webshopId: null,
        types: () => {
            return [...Object.values(EmailTemplateType)].filter(type => {
                const app = useAppContext()
                if (app === 'admin') {
                    return EmailTemplate.allowPlatformLevel(type)
                }
                return EmailTemplate.allowOrganizationLevel(type)
            })
        },
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
    const orgId = organization.value ?? props.groups?.[0]?.organizationId ?? null;
    const base = patched.value.filter(t => !EmailTemplate.isSavedEmail(t.type) && props.types.includes(t.type) && ((t.groupId === null && props.groups === null) || (props.groups && props.groups.some(g => g.id === t.groupId))) && (!orgId || t.organizationId === orgId));

    // Create missing ones
    for (const type of props.types) {
        if (EmailTemplate.isSavedEmail(type)) {
            continue;
        }

        for (const group of (props.groups ?? [null])) {
            if (!base.find(t => t.type === type && t.groupId === (group?.id ?? null))) {
                let defaultTemplate: EmailTemplate | null = patched.value.find(template => template.type === type && template.groupId === null && template.webshopId === null && template.organizationId === null) ?? null;

                if (orgId) {
                    defaultTemplate = patched.value.find(template => template.type === type && template.groupId === null && template.webshopId === null && template.organizationId === orgId) ?? defaultTemplate ?? null;
                }
                
                base.push(
                    EmailTemplate.create({
                        ...defaultTemplate,
                        id: '', // clear
                        organizationId: organization.value?.id ?? null,
                        groupId: group?.id ?? null,
                        webshopId: props.webshopId,
                        type
                    })
                );
            }
        }
    }

    // Now order by type
    base.sort((a, b) => {
        return Sorter.stack(
            Sorter.byStringValue(a.groupId ?? '', b.groupId ?? ''),
            EmailTemplate.getTypeTitle(a.type).localeCompare(EmailTemplate.getTypeTitle(b.type))
        )
    });

    return base;
})

function getTemplatePrefix(emailTemplate: EmailTemplate) {
    if (emailTemplate.groupId && props.groups) {
        const group = props.groups.find(g => g.id === emailTemplate.groupId)
        if (group) {
            return group.settings.name
        }
    }
    return '';
}

async function editEmail(emailTemplate: EmailTemplate) {
    await present({
        components: [
            new ComponentWithProperties(EditEmailTemplateView, {
                prefix: getTemplatePrefix(emailTemplate),
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
                groupIds: props.groups !== null ? [props.groups.map(g => g.id)].join(',') : null,
                webshopId: props.webshopId,
                types: props.types.join(','),
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
        await context.value.authenticatedServer.request({
            method: "PATCH",
            path: "/email-templates",
            shouldRetry: false,
            owner,
            body: patch.value,
            decoder: new ArrayDecoder(EmailTemplate as Decoder<EmailTemplate>)
        })

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
    return await CenteredMessage.confirm($t('Ben je zeker dat je wilt sluiten zonder op te slaan?'), $t('Niet opslaan'))
}

defineExpose({
    shouldNavigateAway
})
</script>
