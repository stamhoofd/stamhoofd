<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ viewTitle }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox :title="$t('%Gq') " error-fields="title" :error-box="errors.errorBox">
                <input v-model="title" class="input" type="text" :placeholder="$t('%Gq') ">
            </STInputBox>
        </div>

        <STInputBox :title="$t('%6o')" error-fields="description" :error-box="errors.errorBox" class="max">
            <textarea v-model="description" class="input" type="text" :placeholder="$t('%8g')" autocomplete="off" />
        </STInputBox>

        <STInputBox :title="$t('%8h')" error-fields="eventTypeIds" :error-box="errors.errorBox" class="max">
            <EventTypeIdsInput v-model="eventTypeIds" />
        </STInputBox>

        <hr><h2>{{ $t('%8i') }}</h2>
        <p>
            {{ $t('%Hv') }} <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">{{ $t('%Hw') }}</a> {{ $t('%Hx') }}
        </p>

        <EditRecordCategoriesBox :categories="patched.recordCategories" :settings="editorSettings" @patch:categories="addPatch({recordCategories: $event})" />

        <hr><h2>{{ $t('%v') }}</h2>
        <p>{{ $t('%Hy') }}</p>

        <STList v-if="patched.deadlines.length">
            <EventNotificationDeadlineRow v-for="deadline in patched.deadlines" :key="deadline.id" :deadline="deadline" @click="editDeadline(deadline)" />
        </STList>

        <p>
            <button class="button text" type="button" @click="addDeadline">
                <span class="icon add" />
                <span>{{ $t('%8d') }}</span>
            </button>
        </p>

        <div class="container">
            <hr><h2>{{ $t('%AY') }}</h2>
            <p>{{ $t('%AZ') }}</p>

            <MultipleChoiceInput v-model="contactResponsibilityIds" :items="responsibilities.map(r => ({value: r.id, name: r.name}))" :nullable="false" />
        </div>

        <div class="container">
            <hr><h2>{{ $t('%Aa') }}</h2>
            <p>{{ $t('%Ab') }}</p>
        </div>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, EditRecordCategoriesBox, ErrorBox, EventTypeIdsInput, MultipleChoiceInput, RecordEditorSettings, RecordEditorType, SaveView, useCountry, useErrors, useEventNotificationInMemoryFilterBuilders, usePatch, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Address, BaseOrganization, EventNotification, EventNotificationDeadline, EventNotificationType, RecordCategory } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import EventNotificationDeadlineRow from './components/EventNotificationDeadlineRow.vue';
import EditEventNotificationDeadlineView from './EditEventNotificationDeadlineView.vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);

const props = defineProps<{
    type: EventNotificationType;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<EventNotificationType>) => Promise<void>;
    deleteHandler: (() => Promise<void>) | null;
}>();
const viewTitle = computed(() => props.isNew ? $t('%8j') : $t('%8k'));
const pop = usePop();
const platform = usePlatform();
const present = usePresent();
const country = useCountry();
const { patched, addPatch, hasChanges, patch } = usePatch(props.type);

const responsibilities = computed(() => {
    return platform.value.config.responsibilities.filter(r => r.organizationBased);
});

const save = async () => {
    if (saving.value || deleting.value) {
        return;
    }
    saving.value = true;
    try {
        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
};

const doDelete = async () => {
    if (saving.value || deleting.value) {
        return;
    }

    if (!props.deleteHandler) {
        return;
    }

    if (!await CenteredMessage.confirm($t('%5p'), $t('%CJ'), $t('%5q'))) {
        return;
    }

    deleting.value = true;
    try {
        await props.deleteHandler();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    deleting.value = false;
};

const title = computed({
    get: () => patched.value.title,
    set: title => addPatch({ title }),
});

const description = computed({
    get: () => patched.value.description,
    set: description => addPatch({ description }),
});

const eventTypeIds = computed({
    get: () => patched.value.eventTypeIds,
    set: eventTypeIds => addPatch({ eventTypeIds: eventTypeIds as any }),
});

const contactResponsibilityIds = computed({
    get: () => patched.value.contactResponsibilityIds,
    set: contactResponsibilityIds => addPatch({ contactResponsibilityIds: contactResponsibilityIds as any }),
});

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }

    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

const getFilterBuilders = useEventNotificationInMemoryFilterBuilders();

const editorSettings = computed(() => {
    return new RecordEditorSettings({
        dataPermission: false,
        type: RecordEditorType.EventNotification,
        filterBuilder: (categories: RecordCategory[]) => {
            return getFilterBuilders(patched.value.patch({
                recordCategories: categories,
            }))[0];
        },
        exampleValue: EventNotification.create({
            typeId: patched.value.id,
            organization: BaseOrganization.create({
                address: Address.create({
                    country: country.value,
                }),
            }),
        }),
    });
});

async function addDeadline() {
    const arr: PatchableArrayAutoEncoder<EventNotificationDeadline> = new PatchableArray();
    const deadline = EventNotificationDeadline.create({});
    arr.addPut(deadline);

    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditEventNotificationDeadlineView, {
                deadline,
                isNew: true,
                saveHandler: (patch: AutoEncoderPatchType<EventNotificationDeadline>) => {
                    patch.id = deadline.id;
                    arr.addPatch(patch);
                    addPatch({ deadlines: arr });
                },
            }),
        ],
    });
}

async function editDeadline(deadline: EventNotificationDeadline) {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(EditEventNotificationDeadlineView, {
                deadline,
                isNew: false,
                saveHandler: (patch: AutoEncoderPatchType<EventNotificationDeadline>) => {
                    const arr: PatchableArrayAutoEncoder<EventNotificationDeadline> = new PatchableArray();
                    arr.addPatch(patch);
                    addPatch({ deadlines: arr });
                },
                deleteHandler: () => {
                    const arr: PatchableArrayAutoEncoder<EventNotificationDeadline> = new PatchableArray();
                    arr.addDelete(deadline.id);
                    addPatch({ deadlines: arr });
                },
            }),
        ],
    });
}

defineExpose({
    shouldNavigateAway,
});
</script>
