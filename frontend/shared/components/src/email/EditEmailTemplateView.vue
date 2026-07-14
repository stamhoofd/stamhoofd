<template>
    <EditorView ref="editorView" class="mail-view" :email-block="emailBlock" :save-text="$t('%1Op')" :loading="contentLanguage.switching.value" :replacements="replacements" :title="$t(`%aP`)" @save="save">
        <template #navigation-buttons>
            <EmailLanguageButton :model-value="contentLanguage.currentLanguage.value" :languages="contentLanguage.languages.value" :default-language="contentLanguage.defaultLanguage.value" :supports-translations="true" :disabled="contentLanguage.switching.value" @update:model-value="contentLanguage.switchTo($event).catch(console.error)" @add="contentLanguage.addLanguage($event).catch(console.error)" @remove="contentLanguage.removeLanguage($event).catch(console.error)" />
        </template>
        <p v-if="prefix" class="style-title-prefix" v-text="prefix" />
        <h1 v-if="isNew" class="style-navigation-title">
            {{ $t('%aM') }}
        </h1>
        <h1 v-else class="style-navigation-title">
            {{ $t('%aN') }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template #list>
            <STListItem class="no-padding">
                <div class="list-input-box">
                    <span>{{ $t('%1B') }}:</span>
                    <span class="list-input">{{ EmailTemplate.getTypeTitle(emailTemplate.type) }}</span>
                </div>
            </STListItem>
            <STListItem class="no-padding right-stack" element-name="label">
                <div class="list-input-box">
                    <span>{{ $t('%aO') }}:</span>
                    <input id="mail-subject" v-model="subject" class="list-input" type="text" :placeholder="$t(`%aQ`)">
                </div>
            </STListItem>
        </template>
    </EditorView>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import type { Replacement } from '@stamhoofd/structures';
import { EmailTemplate, EmailTemplateType } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, nextTick, ref } from 'vue';
import EditorView from '../editor/EditorView.vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePatch } from '#hooks/usePatch.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { CenteredMessage } from '../overlays/CenteredMessage';
import EmailLanguageButton from './EmailLanguageButton.vue';
import { confirmStaleEmailContentLanguages, useEmailContentLanguage } from './hooks/useEmailContentLanguage';
import { useReplacementsForLanguage } from './hooks/useReplacementsForLanguage';

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
const editorView = ref(null) as Ref<typeof EditorView | null>;
const editor = computed(() => editorView.value?.editor);
const pop = usePop();

const organization = useOrganization();
const platform = usePlatform();

const contentLanguage = useEmailContentLanguage({
    editor: () => editor.value,
    patched: () => patched.value,
    addPatch,
});
const subject = contentLanguage.subject;

// The editor content is loaded by useEmailContentLanguage once the editor is available

// The example values are shown in the language that is being edited
const replacements = useReplacementsForLanguage({
    language: () => contentLanguage.currentLanguage.value,
    build: () => {
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

        return base;
    },
});

const emailBlock = computed(() => {
    return EmailTemplate.canAddEmailOnlyContent(patched.value.type);
});

async function confirmStaleTranslations(): Promise<boolean> {
    if (props.isNew) {
        // On creation it doesn't matter that only one language received content
        return true;
    }
    return await confirmStaleEmailContentLanguages(props.emailTemplate, patched.value, {
        ignoreText: $t('%Zdp'),
        switchTo: language => contentLanguage.switchTo(language),
    });
}

async function save() {
    if (contentLanguage.switching.value) {
        return;
    }
    try {
        await contentLanguage.flush();
        await nextTick();

        if (!await confirmStaleTranslations()) {
            return;
        }

        await props.saveHandler(patch.value);
        await pop({ force: true });
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

const shouldNavigateAway = async () => {
    const derived = await contentLanguage.getDerivedContent();
    if (!hasChanges.value && (!derived || derived.text === contentLanguage.contentFor(derived.language).text)) {
        return true;
    }
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});

</script>
