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
                <STListItem :selectable="notification.events.length === 1" @click="isReviewer && notification.events.length === 1 && openEvent(null)">
                    <h3 class="style-definition-label">
                        {{ notification.events.length === 1 ? $t('Activiteitsnaam') : $t('Activiteiten') }}
                    </h3>
                    <p v-for="event of notification.events" :key="event.id" class="style-definition-text" @click="isReviewer && notification.events.length !== 1 && openEvent(event)">
                        <span>{{ notification.events.map(e => e.name).join(', ') }}</span>
                    </p>

                    <template v-if="isReviewer && notification.events.length === 1" #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="app === 'admin'">
                    <h3 class="style-definition-label">
                        {{ $t('Organisator') }}
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ notification.organization.name }} ({{ notification.organization.uri }})</span>
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        Wanneer
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ capitalizeFirstLetter(formatDateRange(notification.startDate, notification.endDate, undefined, false)) }}</span>
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        Status
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ capitalizeFirstLetter(EventNotificationStatusHelper.getName(notification.status)) }}</span>
                        <span v-if="notification.status === EventNotificationStatus.Pending" class="icon clock" />
                        <span v-if="notification.status === EventNotificationStatus.Rejected" class="icon error red" />
                        <span v-if="notification.status === EventNotificationStatus.Accepted" class="icon success green" />
                    </p>

                    <p v-if="notification.submittedBy && notification.submittedAt" class="style-description-small">
                        {{ $t('46e61090-1188-4085-8995-69aef85af678', {name: notification.submittedBy.name, date: formatDate(notification.submittedAt)}) }}
                    </p>
                </STListItem>

                <STListItem v-if="notification.feedbackText && notification.status !== EventNotificationStatus.Accepted" :selectable="isReviewer" @click="isReviewer && editFeedbackText()">
                    <h3 class="style-definition-label">
                        {{ $t('Opmerkingen') }}
                    </h3>
                    <p class="style-definition-text pre-wrap style-em" v-text="notification.feedbackText" />

                    <template v-if="isReviewer" #right>
                        <span class="icon edit gray" />
                    </template>
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
                <ViewRecordCategoryAnswersBox v-for="category in flattenedRecordCategories" :key="'category-'+category.id" :category="category" :value="notification">
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
import { CenteredMessage, ContextMenu, ContextMenuItem, ErrorBox, EventOverview, IconContainer, InputSheet, ProgressIcon, useAppContext, useAuth, ViewRecordCategoryAnswersBox } from '@stamhoofd/components';
import { AccessRight, Event, EventNotification, EventNotificationStatus, EventNotificationStatusHelper, RecordCategory } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { useErrors } from '../errors/useErrors';
import { EventNotificationViewModel } from './event-notifications/classes/EventNotificationViewModel';
import EditEventNotificationRecordCategoryView from './event-notifications/EditEventNotificationRecordCategoryView.vue';
import { SimpleError } from '@simonbackx/simple-errors';

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
const app = useAppContext();
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

const flattenedRecordCategories = computed(() => {
    return RecordCategory.flattenCategories(type.value.recordCategories, notification.value);
});

async function editRecordCategory(recordCategory: RecordCategory) {
    if (!isEnabled(recordCategory)) {
        return;
    }

    // Find root category
    // thsi is required because the flattened versions are not usable for editing
    let rootCategory = recordCategory;
    outerLoop: for (const root of recordCategories.value) {
        if (root.id === recordCategory.id) {
            rootCategory = root;
            break;
        }

        // Check children
        for (const child of root.childCategories) {
            if (child.id === recordCategory.id) {
                rootCategory = root;
                break outerLoop;
            }
        }
    }

    await present({
        components: [
            new ComponentWithProperties(EditEventNotificationRecordCategoryView, {
                viewModel: props.viewModel,
                category: rootCategory,
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

async function openEvent(event: Event | null) {
    event = event ?? notification.value.events[0];

    if (!event) {
        return;
    }

    await present({
        components: [
            new ComponentWithProperties(EventOverview, {
                event: event,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function doSubmit() {
    if (!await CenteredMessage.confirm($t('Ben je zeker dat je deze melding wilt indienen?'), $t('Ja, indienen'), $t('Je kan je melding niet meer aanpassen na het indienen.'), undefined, false)) {
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
    if (!await CenteredMessage.confirm($t('Ben je zeker dat je deze melding wilt goedkeuren?'), $t('Ja, goedkeuren'), $t('Je kan je melding niet meer aanpassen na het indienen.'), undefined, false)) {
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
    await present({
        components: [
            new ComponentWithProperties(InputSheet, {
                title: $t('Reden voor afkeuring'),
                description: $t('Je kan hier een opmerking achterlaten waarom je deze melding afkeurt.'),
                saveText: $t('Afkeuren'),
                placeholder: $t('Reden voor afkeuring'),
                defaultValue: notification.value.feedbackText ?? '',
                multiline: true,
                saveHandler: async (value: string) => {
                    if (!value) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: $t('Gelieve een reden in te vullen'),
                        });
                    }
                    await save(EventNotification.patch({
                        status: EventNotificationStatus.Rejected,
                        feedbackText: value ? value : null,
                    }));
                },
            }),
        ],
        modalDisplayStyle: 'sheet',
    });
}

async function editFeedbackText() {
    await present({
        components: [
            new ComponentWithProperties(InputSheet, {
                title: $t('Opmerkingen wijzigen'),
                description: $t('Je kan hier een opmerking achterlaten waarom je deze melding afkeurt.'),
                saveText: $t('Opslaan'),
                placeholder: $t('Opmerkingen'),
                defaultValue: notification.value.feedbackText ?? '',
                multiline: true,
                saveHandler: async (value: string) => {
                    await save(EventNotification.patch({
                        feedbackText: value ? value : null,
                    }));
                },
            }),
        ],
        modalDisplayStyle: 'sheet',
    });
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
                            name: Formatter.capitalizeFirstLetter(EventNotificationStatusHelper.getName(EventNotificationStatus.Draft)),
                            action: async () => {
                                await doDraft();
                            },
                        }),
                        new ContextMenuItem({
                            name: Formatter.capitalizeFirstLetter(EventNotificationStatusHelper.getName(EventNotificationStatus.Pending)),
                            icon: 'clock',
                            action: async () => {
                                await doSubmit();
                            },
                        }),
                        new ContextMenuItem({
                            name: Formatter.capitalizeFirstLetter(EventNotificationStatusHelper.getName(EventNotificationStatus.Rejected)),
                            icon: 'canceled',
                            action: async () => {
                                await doReject();
                            },
                        }),
                        new ContextMenuItem({
                            name: Formatter.capitalizeFirstLetter(EventNotificationStatusHelper.getName(EventNotificationStatus.Accepted)),
                            icon: 'success',
                            action: async () => {
                                await doAccept();
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
