<template>
    <div class="st-view">
        <STNavigationBar :title="title">
            <template #right>
                <button v-if="isReviewer" v-long-press="(e: any) => showContextMenu(e)" class="button icon more" type="button" @click.prevent="showContextMenu" @contextmenu.prevent="showContextMenu" />
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
                        {{ notification.events.length === 1 ? $t('a7db7ad2-4106-4cf0-a8fc-1e68b0a5bf24') : $t('cbfe8b26-7422-44dd-af53-90e14baa4d9a') }}
                    </h3>
                    <p v-for="event of notification.events" :key="event.id" class="style-definition-text" @click="isReviewer && notification.events.length !== 1 && openEvent(event)">
                        <span>{{ notification.events.map(e => e.name).join(', ') }}</span>
                    </p>
                    <p v-if="notification.events.length === 0" class="style-definition-text style-em">
                        {{ $t('45ff02db-f404-4d91-853f-738d55c40cb6') }}
                    </p>

                    <template v-if="isReviewer && notification.events.length === 1" #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="app === 'admin'">
                    <h3 class="style-definition-label">
                        {{ $t('7f4247c2-2bc1-4f0d-89d5-f4ea51e92bfa') }}
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ notification.organization.name }} ({{ notification.organization.uri }})</span>
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('0ca73738-0649-4dbd-b5d7-b54f03140372') }}
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ capitalizeFirstLetter(formatDateRange(notification.startDate, notification.endDate, undefined, false)) }}</span>
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('e4b54218-b4ff-4c29-a29e-8bf9a9aef0c5') }}
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ capitalizeFirstLetter(EventNotificationStatusHelper.getName(notification.status)) }}</span>
                        <span v-if="notification.status === EventNotificationStatus.Pending" class="icon clock middle" />
                        <span v-if="notification.status === EventNotificationStatus.Rejected" class="icon error red middle" />
                        <span v-if="notification.status === EventNotificationStatus.PartiallyAccepted" class="icon secundary partially middle" />
                        <span v-if="notification.status === EventNotificationStatus.Accepted" class="icon success green middle" />
                    </p>

                    <p v-if="notification.submittedBy && notification.submittedAt" class="style-description-small">
                        {{ $t('46e61090-1188-4085-8995-69aef85af678', {name: notification.submittedBy.name, date: formatDate(notification.submittedAt)}) }}
                    </p>
                </STListItem>

                <STListItem v-if="notification.feedbackText && notification.status !== EventNotificationStatus.Accepted" :selectable="isReviewer" @click="isReviewer && editFeedbackText()">
                    <h3 class="style-definition-label">
                        {{ $t('e4017a21-58c1-4cea-824c-8cef6a7ab019') }}
                    </h3>
                    <p class="style-definition-text pre-wrap style-em" v-text="notification.feedbackText" />

                    <template v-if="isReviewer" #right>
                        <span class="icon edit gray" />
                    </template>
                </STListItem>

                <STListItem v-if="isReviewer && notification.status !== EventNotificationStatus.Accepted && notification.acceptedRecordAnswers.size > 0 && diffList.length">
                    <h3 class="style-definition-label">
                        {{ $t('355512bd-902c-4193-8aa0-81e5cb81284b') }}
                    </h3>
                    <PatchListText :items="diffList" />

                    <template #right>
                        <button class="button icon eye gray" type="button" :v-tooltip="$t('4f634d27-7fa3-4e91-9ae1-dbfdafd2baa4')" @click="showOriginalAnswers" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="notification.status === EventNotificationStatus.Draft">
                <hr><h2>{{ $t('f4d00d5c-77c9-41dd-9689-a447c7977449') }}</h2>
                <p>{{ $t('025be814-a557-46be-be79-a1cc5406a5ed') }}</p>

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
                            {{ $t('212cf5a4-424b-477e-9007-9a9d789f8c08') }}
                        </p>
                        <p v-else-if="getRecordCategoryProgress(category) === 1" class="style-description">
                            {{ $t('7418aed7-61ec-4553-ba8c-301573d32a72') }}
                        </p>
                        <p v-else class="style-description">
                            {{ $t('21b3891d-7c0e-49ca-ae35-d77d54e9f0c3') }}
                        </p>

                        <template #right>
                            <span v-if="isEnabled(category)" class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </template>

            <template v-else>
                <ViewRecordCategoryAnswersBox v-for="category in recordCategories" :key="'category-'+category.id" :category="category" :value="notification">
                    <template v-if="isReviewer || notification.status === EventNotificationStatus.Rejected || notification.status === EventNotificationStatus.PartiallyAccepted" #buttons>
                        <button type="button" class="button icon edit" @click="editRecordCategory(category)" />
                    </template>
                </ViewRecordCategoryAnswersBox>
            </template>

            <div v-if="notification.status === EventNotificationStatus.Pending && isComplete && isReviewer" class="container">
                <hr><h2>{{ $t('00b790ad-2238-4a6a-b7cb-36a60fac1e9f') }}</h2>

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
                            {{ $t('b0657304-772f-4334-be01-da82a190167a') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('4a3e388c-32f3-4f76-be22-9eb435ebb9f9') }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>

                    <STListItem :selectable="true" element-name="button" @click="doAcceptPartially">
                        <template #left>
                            <IconContainer icon="notification" class="secundary">
                                <template #aside>
                                    <span class="icon partially small" />
                                </template>
                            </IconContainer>
                        </template>
                        <h3 class="style-title-list">
                            {{ $t('1b19fc16-6146-42c9-b42e-471f1f18a452') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('a7ed4fc3-5f80-4621-afcb-89002b686cef') }}
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
                            {{ $t('7c422572-6970-460c-8055-af2935f9a76b') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('435950cd-0c43-4f39-9547-c31189725873') }}
                        </p>

                        <template #right>
                            <span class="icon arrow-right-small gray" />
                        </template>
                    </STListItem>
                </STList>
            </div>
        </main>

        <STToolbar v-if="notification.status === EventNotificationStatus.Draft || notification.status === EventNotificationStatus.Rejected || notification.status === EventNotificationStatus.PartiallyAccepted">
            <template #right>
                <LoadingButton :loading="isSaving">
                    <button class="button primary" :disabled="!isComplete" type="button" @click="doSubmit">
                        <span v-if="notification.status === EventNotificationStatus.Rejected || notification.status === EventNotificationStatus.PartiallyAccepted" class="icon retry" />
                        <span v-else class="icon success" />

                        <span v-if="notification.status === EventNotificationStatus.Rejected || notification.status === EventNotificationStatus.PartiallyAccepted">{{ $t('b72d05c4-9e64-4254-9580-7123bf7479c3') }}</span>
                        <span v-else>{{ $t('0b8d1425-4240-4fa8-8150-9a7824ef1c7d') }}</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script setup lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ContextMenu, ContextMenuItem, ErrorBox, EventOverview, IconContainer, InputSheet, PatchListText, ProgressIcon, useAppContext, useAuth, ViewRecordCategoryAnswersBox } from '@stamhoofd/components';
import { ObjectDiffer } from '@stamhoofd/object-differ';
import { AccessRight, Event, EventNotification, EventNotificationStatus, EventNotificationStatusHelper, RecordCategory } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { useErrors } from '../errors/useErrors';
import { EventNotificationViewModel } from './event-notifications/classes/EventNotificationViewModel';
import EditEventNotificationRecordCategoryView from './event-notifications/EditEventNotificationRecordCategoryView.vue';
import OriginalEventNotificationAnswersView from './OriginalEventNotificationAnswersView.vue';

const props = withDefaults(
    defineProps<{
        viewModel: EventNotificationViewModel;
    }>(), {

    },
);

const notification = props.viewModel.useNotification();
const errors = useErrors();
const type = props.viewModel.useType();
const present = usePresent();
const auth = useAuth();
const app = useAppContext();
const pop = usePop();
const isReviewer = computed(() => {
    const p = auth.getPermissionsForOrganization(props.viewModel.eventNotification.organization);
    return p?.hasAccessRight(AccessRight.OrganizationEventNotificationReviewer) ?? false;
});
const isComplete = computed(() => {
    return recordCategories.value.every(c => c.isComplete(notification.value));
});
const { save, deleteModel, isSaving } = props.viewModel.useSave();

const diffList = computed(() => {
    return ObjectDiffer.diff(notification.value.acceptedRecordAnswers, notification.value.recordAnswers);
});

const title = computed(() => {
    return type.value.title;
});

const recordCategories = computed(() => {
    return RecordCategory.filterCategories(type.value.recordCategories, notification.value);
});

const flattenedRecordCategories = computed(() => {
    return RecordCategory.flattenCategories(type.value.recordCategories, notification.value);
});

function getRootCategory(recordCategory: RecordCategory) {
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
    return rootCategory;
}

async function editRecordCategory(recordCategory: RecordCategory) {
    // Find root category
    // thsi is required because the flattened versions are not usable for editing
    const rootCategory = getRootCategory(recordCategory);

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
    const rootCategory = getRootCategory(category);

    // Check all previous categories complete
    for (const c of recordCategories.value) {
        if (c === rootCategory) {
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
    if (!await CenteredMessage.confirm($t('ec0978f8-95bc-44c9-a906-ceaf6fd55baf'), $t('6b0ddff7-226f-4616-a0da-a280d0ccc2ff'), $t('754f6578-9fee-44f3-931c-dc00a34d7871'), undefined, false)) {
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
async function doAcceptPartially() {
    await present({
        components: [
            new ComponentWithProperties(InputSheet, {
                title: $t('15407414-de94-40bf-8a62-c5f37613ed39'),
                description: $t('153fcd92-0ce3-4465-b9ce-b2e68c496a9a'),
                saveText: $t('15407414-de94-40bf-8a62-c5f37613ed39'),
                placeholder: $t('387f4352-c78d-4e21-9dfe-a2433e3ba554'),
                defaultValue: notification.value.feedbackText ?? '',
                multiline: true,
                saveHandler: async (value: string) => {
                    if (!value) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: $t('63e45277-76d4-4971-909b-1c86326b609f'),
                        });
                    }
                    await save(EventNotification.patch({
                        status: EventNotificationStatus.PartiallyAccepted,
                        feedbackText: value ? value : null,
                    }));
                },
            }),
        ],
        modalDisplayStyle: 'sheet',
    });
}

async function doAccept() {
    if (!await CenteredMessage.confirm($t('f48e7518-0f1d-4610-a967-82d146a47f5b'), $t('eacd1cfa-a04b-485b-bd8d-41c1518e5306'), $t('754f6578-9fee-44f3-931c-dc00a34d7871'), undefined, false)) {
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
                title: $t('f1bebbb8-20dc-4e6c-886d-68f080f71a1e'),
                description: $t('2d9128d3-a428-4ba6-9b12-6c2f00ca7c31'),
                saveText: $t('fe9c9ec1-dd24-4fc6-9622-7b5aef4e9208'),
                placeholder: $t('f1bebbb8-20dc-4e6c-886d-68f080f71a1e'),
                defaultValue: notification.value.feedbackText ?? '',
                multiline: true,
                saveHandler: async (value: string) => {
                    if (!value) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: $t('63e45277-76d4-4971-909b-1c86326b609f'),
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
                title: $t('938b1f40-9563-4a26-8d87-05774839b5a7'),
                description: $t('2d9128d3-a428-4ba6-9b12-6c2f00ca7c31'),
                saveText: $t('cb13500b-5d71-46df-846c-03f27b898dd7'),
                placeholder: $t('e4017a21-58c1-4cea-824c-8cef6a7ab019'),
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

async function showOriginalAnswers() {
    await present({
        components: [
            new ComponentWithProperties(OriginalEventNotificationAnswersView, {
                viewModel: props.viewModel,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function doDelete() {
    if (!await CenteredMessage.confirm($t(`663a1f20-3b21-4e8d-bb21-530918648af1`), $t(`37907821-2e63-4f33-9ae6-db1b0d82f086`), $t(`988f9fce-a36a-44b5-8df6-5d9ff9eaa694`))) {
        return;
    }
    try {
        await deleteModel();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

async function doDraft() {
    if (!await CenteredMessage.confirm($t(`3074ee0a-4531-47d5-a167-d058d8fc2c96`), $t(`21e75f22-0079-4a82-bc0e-b8ecf877d39c`))) {
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
                name: $t(`13daa284-503c-4841-a2ec-16d89ab38cdc`),
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
                            name: Formatter.capitalizeFirstLetter(EventNotificationStatusHelper.getName(EventNotificationStatus.PartiallyAccepted)),
                            icon: 'partially',
                            action: async () => {
                                await doAcceptPartially();
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
                name: $t(`25d866b7-3859-4a5d-b875-bc286e69f846`),
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
