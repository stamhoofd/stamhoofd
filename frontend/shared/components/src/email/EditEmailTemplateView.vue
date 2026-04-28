<template>
    <EditorView ref="editorView" class="mail-view" :email-block="emailBlock" :save-text="$t('%1Op')" :replacements="replacements" :title="$t(`%aP`)" @save="save">
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
            <STListItem class="no-padding" element-name="label">
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
import type { Ref} from 'vue';
import { computed, nextTick, onMounted, ref } from 'vue';
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
const editorView = ref(null) as Ref<typeof EditorView | null>;
const editor = computed(() => editorView.value?.editor);
const pop = usePop();

const organization = useOrganization();
const platform = usePlatform();

onMounted(() => {
    if (props.emailTemplate.json && (props.emailTemplate.json as any).type) {
        editor.value?.commands.setContent(props.emailTemplate.json);
    }
});

const subject = computed({
    get: () => patched.value.subject,
    set: subject => addPatch({ subject }),
});

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

    return base;
});

const emailBlock = computed(() => {
    return EmailTemplate.canAddEmailOnlyContent(patched.value.type);
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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});

</script>
