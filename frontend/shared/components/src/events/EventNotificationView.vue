<template>
    <div class="st-view">
        <STNavigationBar :title="title">
            <template #right>
                <button v-if="isReviewer" v-long-press="(e) => showContextMenu(e)" class="button icon navigation more" type="button" @click.prevent="showContextMenu" @contextmenu.prevent="showContextMenu" />
            </template>
        </STNavigationBar>

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

            <template v-else>
                <ViewRecordCategoryAnswersBox v-for="category in recordCategories" :key="'category-'+category.id" :category="category" :value="notification">
                    <template v-if="isReviewer" #buttons>
                        <button type="button" class="button icon edit" @click="editRecordCategory(category)" />
                    </template>
                </ViewRecordCategoryAnswersBox>
            </template>

            <div v-if="notification.status === EventNotificationStatus.Pending && isComplete && isReviewer" class="container">
                <hr>
                <h2>Beslissing</h2>

                <STList>
                    <STListItem :selectable="true" element-name="button" @click="doAccept">
                        <template #left>
                            <IconContainer icon="notification" class="success">
                                <template #aside>
                                    <span class="icon success small" />
                                </template>
                            </IconContainer>
                        </template>
                        <h3 class="style-title-list">
                            Goedkeuren
                        </h3>
                        <p class="style-description-small">
                            Keur deze melding goed.
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" element-name="button" @click="doReject">
                        <template #left>
                            <IconContainer icon="notification" class="error">
                                <template #aside>
                                    <span class="icon canceled small" />
                                </template>
                            </IconContainer>
                        </template>

                        <h3 class="style-title-list">
                            Afkeuren
                        </h3>
                        <p class="style-description-small">
                            Hierna zijn er terug wijzigingen mogelijk. Laat eventueel een opmerking achter.
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </div>
        </main>

        <STToolbar v-if="notification.status === EventNotificationStatus.Draft || notification.status === EventNotificationStatus.Rejected">
            <template #right>
                <LoadingButton :loading="isSaving">
                    <button class="button primary" :disabled="!isComplete" type="button" @click="doSubmit">
                        <span v-if="notification.status === EventNotificationStatus.Rejected" class="icon retry" />
                        <span v-else class="icon success" />

                        <span v-if="notification.status === EventNotificationStatus.Rejected">Opnieuw indienen</span>
                        <span v-else>Indienen</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ContextMenu, ContextMenuItem, ErrorBox, IconContainer, ProgressIcon, useAuth, ViewRecordCategoryAnswersBox } from '@stamhoofd/components';
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

async function doAccept() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je wilt goedkeuren?', 'Ja, goedkeuren', 'Je kan je melding niet meer aanpassen na het indienen.', undefined, false)) {
        return;
    }
    try {
        await save(EventNotification.patch({
            status: EventNotificationStatus.Accepted,
        }));
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

async function doReject() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je wilt afkeuren?', 'Ja, afkeuren', undefined)) {
        return;
    }
    try {
        await save(EventNotification.patch({
            status: EventNotificationStatus.Rejected,
        }));
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

async function doDelete() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je deze melding wilt verwijderen?', 'Ja, verwijderen', 'Je kan dit niet ongedaan maken')) {
        return;
    }
    try {
        await save(EventNotification.patch({
            status: EventNotificationStatus.Rejected,
        }));
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

async function doDraft() {
    if (!await CenteredMessage.confirm('Ben je zeker dat je deze melding terug naar klad wilt verplaatsen?', 'Ja, naar klad')) {
        return;
    }
    try {
        await save(EventNotification.patch({
            status: EventNotificationStatus.Draft,
        }));
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

async function showContextMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: 'Wijzig status',
                childMenu: new ContextMenu([
                    [
                        new ContextMenuItem({
                            name: 'Klad',
                            action: async () => {
                                await doDraft();
                            },
                        }),
                        new ContextMenuItem({
                            name: 'Wacht op goedkeuring',
                            icon: 'clock',
                            action: async () => {
                                await doSubmit();
                            },
                        }),
                        new ContextMenuItem({
                            name: 'Goedgekeurd',
                            icon: 'success',
                            action: async () => {
                                await doAccept();
                            },
                        }),
                        new ContextMenuItem({
                            name: 'Afgekeurd',
                            icon: 'canceled',
                            action: async () => {
                                await doReject();
                            },
                        }),
                    ],
                ]),
            }),
            new ContextMenuItem({
                name: 'Verwijderen',
                icon: 'trash',
                action: async () => {
                    await doDelete();
                },
            }),
        ],
    ]);

    await menu.show({ button: event.target as HTMLElement });
}

</script>
