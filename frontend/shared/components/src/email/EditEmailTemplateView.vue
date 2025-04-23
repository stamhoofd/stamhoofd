<template>
    <EditorView ref="editorView" class="mail-view" :save-text="$t('a103aa7c-4693-4bd2-b903-d14b70bfd602')" :replacements="replacements" :title="$t(`6a972ca2-8a5f-4e9d-bb26-b59e1f7165a2`)" @save="save">
        <p v-if="prefix" class="style-title-prefix" v-text="prefix" />
        <h1 v-if="isNew" class="style-navigation-title">
            {{ $t('8af02386-a68c-46c0-bb86-91b2177f1ba6') }}
        </h1>
        <h1 v-else class="style-navigation-title">
            {{ $t('6b77538c-6e3a-461c-9f97-f3aa71c8838d') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template #list>
            <STListItem class="no-padding">
                <div class="list-input-box">
                    <span>{{ $t('6c9d45e5-c9f6-49c8-9362-177653414c7e') }}:</span>
                    <span class="list-input">{{ EmailTemplate.getTypeTitle(emailTemplate.type) }}</span>
                </div>
            </STListItem>
            <STListItem class="no-padding" element-name="label">
                <div class="list-input-box">
                    <span>{{ $t('709a5ff3-8d79-447b-906d-2c3cdabb41cf') }}:</span>
                    <input id="mail-subject" v-model="subject" class="list-input" type="text" :placeholder="$t(`13b42902-e159-4e6a-8562-e87c9c691c8b`)">
                </div>
            </STListItem>
        </template>
    </EditorView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { EmailTemplate, Replacement, getExampleRecipient } from '@stamhoofd/structures';
import { Ref, computed, nextTick, onMounted, ref } from 'vue';
import EditorView from '../editor/EditorView.vue';
import { EmailStyler } from '../editor/EmailStyler';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useOrganization, usePatch, usePlatform } from '../hooks';
import { CenteredMessage } from '../overlays/CenteredMessage';

const props = withDefaults(
    defineProps<{
        emailTemplate: EmailTemplate;
        isNew: boolean;
        saveHandler: (patch: AutoEncoderPatchType<EmailTemplate>) => Promise<void>;
        prefix?: string | null;
    }>(), {
        prefix: null,
    },
);

const { patched, addPatch, hasChanges, patch } = usePatch(props.emailTemplate);
const errors = useErrors();
const editorView = ref(null) as Ref<EditorView | null>;
const editor = computed(() => editorView.value?.editor);
const pop = usePop();

const organization = useOrganization();
const platform = usePlatform();

onMounted(() => {
    if (props.emailTemplate.json && props.emailTemplate.json.type) {
        editor.value?.commands.setContent(props.emailTemplate.json);
    }
});

const subject = computed({
    get: () => patched.value.subject,
    set: subject => addPatch({ subject }),
});

const exampleRecipient = computed(() => EmailTemplate.getRecipientType(patched.value.type) ? getExampleRecipient(EmailTemplate.getRecipientType(patched.value.type)) : null);
const replacements = computed(() => {
    const base: Replacement[] = [...EmailTemplate.getSupportedReplacementsForType(patched.value.type)];

    if (platform.value) {
        const defaultReplacements = platform.value.config.getEmailReplacements(platform.value, true);
        base.unshift(...defaultReplacements);
    }

    // Change some defaults
    if (organization.value) {
        const defaultReplacements = organization.value.meta.getEmailReplacements(organization.value);
        base.unshift(...defaultReplacements);
    }

    if (exampleRecipient.value) {
        return [...exampleRecipient.value.replacements, ...exampleRecipient.value.getDefaultReplacements(), ...base];
    }
    return base;
});

async function getHTML() {
    const e = editor.value;
    if (!e) {
        // When editor is not yet loaded: slow internet -> need to know html on dismiss confirmation
        return {
            text: '',
            html: '',
            json: {},
        };
    }

    const base: string = e.getHTML();
    return {
        ...await EmailStyler.format(base, subject.value),
        json: e.getJSON(),
    };
}

async function save() {
    try {
        addPatch({
            ...(await getHTML()),
        });
        await nextTick();
        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value && (await getHTML()).text === patched.value.text) {
        return true;
    }
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

defineExpose({
    shouldNavigateAway,
});

</script>
