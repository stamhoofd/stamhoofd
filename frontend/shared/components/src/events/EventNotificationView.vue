<template>
    <div class="st-view">
        <STNavigationBar :title="title" />

        <main>
            <h1>
                {{ title }}
            </h1>
            <p>{{ type.description }}</p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <STList class="info">
                <STListItem :selectable="true">
                    <h3 class="style-definition-label">
                        {{ notification.events.length === 1 ? 'Naam' : 'Activiteiten' }}
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ notification.events.map(e => e.name).join(', ') }}</span>
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        Wanneer
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ capitalizeFirstLetter(formatDateRange(notification.startDate, notification.endDate)) }}</span>
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        Status
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ notification.status }}</span>
                        <span class="icon clock" />
                    </p>

                    <p v-if="notification.submittedBy" class="style-description-small">
                        Ingediend door {{ notification.submittedBy.name }}
                    </p>
                </STListItem>

                <STListItem v-if="notification.feedbackText">
                    <h3 class="style-definition-label">
                        Opmerkingen
                    </h3>
                    <p class="style-definition-text">
                        {{ notification.feedbackText }}
                    </p>
                </STListItem>
            </STList>

            <template v-if="notification.status === EventNotificationStatus.Draft">
                <hr>
                <h2>Gegevens</h2>
                <p>Vul de gegevens hieronder aan voor je de kampmelding indient.</p>

                <!-- For each record category: a new view -->
                <STList>
                    <STListItem v-for="category of recordCategories" :key="category.id" :selectable="isEnabled(category)" :disabled="!isEnabled(category)" @click="editRecordCategory(category)">
                        <template #left>
                            <IconContainer :icon="'file-filled'" :class="getRecordCategoryProgress(category) === 1 ? 'success' : 'gray'">
                                <template #aside>
                                    <ProgressIcon :icon="getRecordCategoryProgress(category) === 1 ? 'success' : undefined" :progress="getRecordCategoryProgress(category)" />
                                </template>
                            </IconContainer>
                        </template>
                        <h3 class="style-title-list">
                            {{ category.name }}
                        </h3>
                        <p v-if="getRecordCategoryProgress(category) === 0" class="style-description">
                            Nog niet ingevuld
                        </p>
                        <p v-else-if="getRecordCategoryProgress(category) === 1" class="style-description">
                            Volledig ingevuld
                        </p>
                        <p v-else class="style-description">
                            Onvolledig
                        </p>

                        <template #right>
                            <span v-if="isEnabled(category)" class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <ViewRecordCategoryAnswersBox v-for="category in recordCategories" :key="'category-'+category.id" :category="category" :value="notification">
                <template v-if="isReviewer" #buttons>
                    <button type="button" class="button icon edit" @click="editRecordCategory(category)" />
                </template>
            </ViewRecordCategoryAnswersBox>
        </main>

        <STToolbar v-if="notification.status === EventNotificationStatus.Draft">
            <template #right>
                <LoadingButton :loading="isSaving">
                    <button class="button primary" :disabled="!isComplete" type="button" @click="doSubmit">
                        <span class="icon success" />
                        <span>Indienen</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, IconContainer, ProgressIcon, useAppContext, useAuth, ViewRecordCategoryAnswersBox } from '@stamhoofd/components';
import { AccessRight, EventNotification, EventNotificationStatus, RecordCategory } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useErrors } from '../errors/useErrors';
import { EventNotificationViewModel } from './event-notifications/classes/EventNotificationViewModel';
import EditEventNotificationRecordCategoryView from './event-notifications/EditEventNotificationRecordCategoryView.vue';

const props = withDefaults(
    defineProps<{
        viewModel: EventNotificationViewModel;
    }>(), {

    },
);

const notification = props.viewModel.useNotification();
const errors = useErrors(); ;
const type = props.viewModel.useType();
const present = usePresent();
const auth = useAuth();
const isReviewer = computed(() => {
    const p = auth.getPermissionsForOrganization(props.viewModel.eventNotification.organization);
    console.log('permissions', p);
    return p?.hasAccessRight(AccessRight.OrganizationEventNotificationReviewer) ?? false;
});
const isComplete = computed(() => {
    return recordCategories.value.every(c => c.isComplete(notification.value));
});
const { save, isSaving } = props.viewModel.useSave();

const title = computed(() => {
    return type.value.title;
});

const recordCategories = computed(() => {
    return RecordCategory.filterCategories(type.value.recordCategories, notification.value);
});

async function editRecordCategory(recordCategory: RecordCategory) {
    if (!isEnabled(recordCategory)) {
        return;
    }
    await present({
        components: [
            new ComponentWithProperties(EditEventNotificationRecordCategoryView, {
                viewModel: props.viewModel,
                category: recordCategory,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

function isEnabled(category: RecordCategory) {
    // Check all previous categories complete
    for (const c of recordCategories.value) {
        if (c === category) {
            return true;
        }
        if (c.getTotalCompleteRecords(notification.value) !== c.getTotalRecords(notification.value)) {
            return false;
        }
    }
    return true;
}

function getRecordCategoryProgress(category: RecordCategory) {
    const total = category.getTotalRecords(notification.value);
    const completed = category.getTotalCompleteRecords(notification.value);
    if (total === 0) {
        return 0;
    }
    return (completed / total);
}

async function doSubmit() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je wilt indienen?', 'Ja, indienen', 'Je kan je melding niet meer aanpassen na het indienen.', undefined, false)) {
        return;
    }
    try {
        await save(EventNotification.patch({
            status: EventNotificationStatus.Pending,
        }));
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

</script>
