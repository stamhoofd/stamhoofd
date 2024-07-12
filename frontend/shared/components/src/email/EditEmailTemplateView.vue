<template>
    <EditorView ref="editorView" class="mail-view" title="E-mail template" save-text="Opslaan" :smart-variables="smartVariables" :smart-buttons="smartButtons" @save="save">
        <h1 v-if="isNew" class="style-navigation-title">
            Nieuwe template
        </h1>
        <h1 v-else class="style-navigation-title">
            Wijzig template
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <!-- List -->
        <template #list>
            <STListItem class="no-padding">
                <div class="list-input-box">
                    <span>Type:</span>
                    <span class="list-input">{{ EmailTemplate.getTypeTitle(emailTemplate.type) }}</span>
                </div>
            </STListItem>
            <STListItem class="no-padding" element-name="label">
                <div class="list-input-box">
                    <span>Onderwerp:</span>
                    <input id="mail-subject" v-model="subject" class="list-input" type="text" placeholder="Typ hier het onderwerp van je e-mail">
                </div>
            </STListItem>
        </template>
    </EditorView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { EditorSmartButton, EditorSmartVariable, EmailTemplate, EmailTemplateType, getExampleRecipient } from '@stamhoofd/structures';
import { Ref, computed, onMounted, ref } from 'vue';
import EditorView from '../editor/EditorView.vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { usePatch } from '../hooks';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { EmailStyler } from '../editor/EmailStyler';

const props = defineProps<{
    emailTemplate: EmailTemplate;
    isNew: boolean;
    saveHandler: (patch: AutoEncoderPatchType<EmailTemplate>) => Promise<void>;
}>();

const {patched, addPatch, hasChanges, patch} = usePatch(props.emailTemplate);
const errors = useErrors()
const editorView = ref(null) as Ref<EditorView | null>;
const editor = computed(() => editorView.value?.editor);
const pop = usePop()
const $t = useTranslate();

onMounted(() => {
    if (props.emailTemplate.json && props.emailTemplate.json.type) {
        editor.value?.commands.setContent(props.emailTemplate.json)
    }
});

const subject = computed({
    get: () => patched.value.subject,
    set: (subject) => addPatch({subject})
});

const exampleRecipient = computed(() => EmailTemplate.getRecipientType(patched.value.type) ? getExampleRecipient(EmailTemplate.getRecipientType(patched.value.type)) : null);
const smartVariables = computed(() => {
    if (exampleRecipient.value) {
        return EditorSmartVariable.forRecipient(exampleRecipient.value)
    }
    const a = EmailTemplate.getSupportedReplacementsForType(patched.value.type);
    return EditorSmartVariable.all.filter(v => a.includes(v.id));
});
const smartButtons = computed(() => {
    if (exampleRecipient.value) {
        return EditorSmartButton.forRecipient(exampleRecipient.value)
    }

    const a = EmailTemplate.getSupportedReplacementsForType(patched.value.type);
    return EditorSmartButton.all.filter(v => a.includes(v.id));
});

async function getHTML() {
    const e = editor.value
    if (!e) {
        // When editor is not yet loaded: slow internet -> need to know html on dismiss confirmation
        return {
            text: "",
            html: "",
            json: {}
        }
    }

    const base: string = e.getHTML();
    return {
        ...await EmailStyler.format(base, subject.value),
        json: e.getJSON()
    }
}

async function save() {
    try {
        addPatch({
            ...(await getHTML())
        })
        await props.saveHandler(patched.value);
        await pop({force: true})
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value && (await getHTML()).text == patched.value.text) {
        return true;
    }
    return await CenteredMessage.confirm($t('shared.save.shouldNavigateAway.title'), $t('shared.save.shouldNavigateAway.confirm'))
}

defineExpose({
    shouldNavigateAway
})

</script>
