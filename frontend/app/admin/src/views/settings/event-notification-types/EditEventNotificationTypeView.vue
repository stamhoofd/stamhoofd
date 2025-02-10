<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save" v-on="!isNew && deleteHandler ? {delete: doDelete} : {}">
        <h1>
            {{ viewTitle }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox :title="$t('9ffdbf7d-83b1-45e3-8ad5-db07b4a22d1e') " error-fields="title" :error-box="errors.errorBox">
                <input
                    v-model="title"
                    class="input"
                    type="text"
                    :placeholder="$t('9ffdbf7d-83b1-45e3-8ad5-db07b4a22d1e') "
                >
            </STInputBox>
        </div>

        <STInputBox :title="$t('688fc9a3-68af-4aa3-ae6c-7d35a5f954ad')" error-fields="description" :error-box="errors.errorBox" class="max">
            <textarea
                v-model="description"
                class="input"
                type="text"
                :placeholder="$t('68bd7b1d-9492-40ca-89f5-917143932218')"
                autocomplete=""
            />
        </STInputBox>

        <STInputBox :title="$t('51850490-5d94-4e0b-a415-9b84e07d86f2')" error-fields="eventTypeIds" :error-box="errors.errorBox" class="max">
            <EventTypeIdsInput v-model="eventTypeIds" />
        </STInputBox>

        <hr>
        <h2>{{ $t('1a559b46-1863-4782-8cb5-ee6517a2e91d') }}</h2>
        <p>
            Lees <a :href="$domains.getDocs('vragenlijsten-instellen')" class="inline-link" target="_blank">hier</a> meer informatie na over hoe je een vragenlijst kan instellen.
        </p>

        <EditRecordCategoriesBox :categories="patched.recordCategories" :settings="editorSettings" @patch:categories="addPatch({recordCategories: $event})" />

        <hr>
        <h2>Deadlines</h2>
        <p>Via deadlines kan je instellen wanneer de leiding een kampmelding moet invullen.</p>

        <STList v-if="patched.deadlines.length">
            <EventNotificationDeadlineRow v-for="deadline in patched.deadlines" :key="deadline.id" :deadline="deadline" @click="editDeadline(deadline)" />
        </STList>

        <p>
            <button class="button text" type="button" @click="addDeadline">
                <span class="icon add" />
                <span>{{ $t('59eba98e-b382-4075-af33-f8bf30b1042c') }}</span>
            </button>
        </p>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, EditRecordCategoriesBox, ErrorBox, EventTypeIdsInput, getEventNotificationUIFilterBuilders, RecordEditorSettings, RecordEditorType, SaveView, useCountry, useErrors, usePatch, usePlatform } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Address, BaseOrganization, EventNotification, EventNotificationDeadline, EventNotificationType, PatchAnswers, RecordCategory } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import EventNotificationDeadlineRow from './components/EventNotificationDeadlineRow.vue';
import EditEventNotificationDeadlineView from './EditEventNotificationDeadlineView.vue';

const errors = useErrors();
const saving = ref(false);
const deleting = ref(false);
const $t = useTranslate();

const props = defineProps<{
    type: EventNotificationType;
    isNew: boolean;
    saveHandler: (p: AutoEncoderPatchType<EventNotificationType>) => Promise<void>;
    deleteHandler: (() => Promise<void>) | null;
}>();
const viewTitle = computed(() => props.isNew ? $t('4f83e88b-bf47-43fe-96ca-b24d136deaa8') : $t('d76e80a1-b717-4002-b40c-1e890e87bf1c'));
const pop = usePop();
const platform = usePlatform();
const present = usePresent();
const country = useCountry();
const { patched, addPatch, hasChanges, patch } = usePatch(props.type);

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

    if (!await CenteredMessage.confirm($t('24cdd0db-df35-4ef2-8230-7cade040fcfc'), $t('838cae8b-92a5-43d2-82ba-01b8e830054b'), $t('dc8871b4-8d65-4247-9c2b-56e183cdf052'))) {
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

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }

    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};

const editorSettings = computed(() => {
    return new RecordEditorSettings({
        dataPermission: false,
        type: RecordEditorType.EventNotification,
        filterBuilder: (_categories: RecordCategory[]) => {
            return getEventNotificationUIFilterBuilders(platform.value)[0];
        },
        exampleValue: EventNotification.create({
            typeId: patched.value.id,
            organization: BaseOrganization.create({
                address: Address.create({
                    country: country.value,
                }),
            }),
        }),
        patchExampleValue(value: EventNotification, patch: PatchAnswers) {
            const cloned = value.clone();

            value.patch(EventNotification.patch({
                recordAnswers: patch,
            }));

            return cloned;
        },
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
