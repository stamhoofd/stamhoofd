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
                        {{ notification.events.length === 1 ? $t('%B9') : $t('%uB') }}
                    </h3>
                    <p v-for="event of notification.events" :key="event.id" class="style-definition-text" @click="isReviewer && notification.events.length !== 1 && openEvent(event)">
                        <span>{{ notification.events.map(e => e.name).join(', ') }}</span>
                    </p>
                    <p v-if="notification.events.length === 0" class="style-definition-text style-em">
                        {{ $t('%1FW') }}
                    </p>

                    <template v-if="isReviewer && notification.events.length === 1" #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>

                <STListItem v-if="app === 'admin'">
                    <h3 class="style-definition-label">
                        {{ $t('%cL') }}
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ notification.organization.name }} ({{ notification.organization.uri }})</span>
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('%ag') }}
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ capitalizeFirstLetter(formatDateRange(notification.startDate, notification.endDate, undefined, false)) }}</span>
                    </p>
                </STListItem>

                <STListItem>
                    <h3 class="style-definition-label">
                        {{ $t('%1A') }}
                    </h3>
                    <p class="style-definition-text">
                        <span>{{ capitalizeFirstLetter(EventNotificationStatusHelper.getName(notification.status)) }}</span>
                        <span v-if="notification.status === EventNotificationStatus.Pending" class="icon clock middle" />
                        <span v-if="notification.status === EventNotificationStatus.Rejected" class="icon error red middle" />
                        <span v-if="notification.status === EventNotificationStatus.PartiallyAccepted" class="icon secundary partially middle" />
                        <span v-if="notification.status === EventNotificationStatus.Accepted" class="icon success green middle" />
                    </p>

                    <p v-if="notification.submittedBy && notification.submittedAt" class="style-description-small">
                        {{ $t('%Ax', {name: notification.submittedBy.name, date: formatDate(notification.submittedAt)}) }}
                    </p>
                </STListItem>

                <STListItem v-if="notification.feedbackText && notification.status !== EventNotificationStatus.Accepted" :selectable="isReviewer" @click="isReviewer && editFeedbackText()">
                    <h3 class="style-definition-label">
                        {{ $t('%YT') }}
                    </h3>
                    <p class="style-definition-text pre-wrap style-em" v-text="notification.feedbackText" />

                    <template v-if="isReviewer" #right>
                        <span class="icon edit gray" />
                    </template>
                </STListItem>

                <STListItem v-if="isReviewer && notification.status !== EventNotificationStatus.Accepted && notification.acceptedRecordAnswers.size > 0 && diffList.length">
                    <h3 class="style-definition-label">
                        {{ $t('%Ca') }}
                    </h3>
                    <PatchListText :items="diffList" />

                    <template #right>
                        <button class="button icon eye gray" type="button" :v-tooltip="$t('%ah')" @click="showOriginalAnswers" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="notification.status === EventNotificationStatus.Draft">
                <hr><h2>{{ $t('%zM') }}</h2>
                <p>{{ $t('%ai') }}</p>

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
                            {{ $t('%aj') }}
                        </p>
                        <p v-else-if="getRecordCategoryProgress(category) === 1" class="style-description">
                            {{ $t('%ak') }}
                        </p>
                        <p v-else class="style-description">
                            {{ $t('%Ni') }}
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
                <hr><h2>{{ $t('%al') }}</h2>

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
                            {{ $t('%am') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('%an') }}
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
                            {{ $t('%ao') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('%ap') }}
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
                            {{ $t('%aq') }}
                        </h3>
                        <p class="style-description-small">
                            {{ $t('%ar') }}
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

                        <span v-if="notification.status === EventNotificationStatus.Rejected || notification.status === EventNotificationStatus.PartiallyAccepted">{{ $t('%as') }}</span>
                        <span v-else>{{ $t('%at') }}</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script setup lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { ContextMenu } from '#overlays/ContextMenu.ts';
import { ContextMenuItem } from '#overlays/ContextMenu.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import EventOverview from '#events/EventOverview.vue';
import InputSheet from '#overlays/InputSheet.vue';
import PatchListText from '#audit-logs/components/PatchListText.vue';
import { useAppContext } from '#context/appContext.ts';
import { useAuth } from '#hooks/useAuth.ts';
import ViewRecordCategoryAnswersBox from '#records/components/ViewRecordCategoryAnswersBox.vue';
import IconContainer from '#icons/IconContainer.vue';
import ProgressIcon from '#icons/ProgressIcon.vue';
import { ObjectDiffer } from '@stamhoofd/object-differ';
import type { Event} from '@stamhoofd/structures';
import { AccessRight, EventNotification, EventNotificationStatus, EventNotificationStatusHelper, RecordCategory } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { useErrors } from '../errors/useErrors';
import type { EventNotificationViewModel } from './classes/EventNotificationViewModel';
import EditEventNotificationRecordCategoryView from './EditEventNotificationRecordCategoryView.vue';
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
    if (!await CenteredMessage.confirm($t('%BA'), $t('%BB'), $t('%BC'), undefined, false)) {
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
                title: $t('%Cb'),
                description: $t('%Cc'),
                saveText: $t('%Cb'),
                placeholder: $t('%YT'),
                defaultValue: notification.value.feedbackText ?? '',
                multiline: true,
                saveHandler: async (value: string) => {
                    if (!value) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: $t('%BH'),
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
    if (!await CenteredMessage.confirm($t('%BD'), $t('%BE'), $t('%BC'), undefined, false)) {
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
                title: $t('%BF'),
                description: $t('%BG'),
                saveText: $t('%aq'),
                placeholder: $t('%BF'),
                defaultValue: notification.value.feedbackText ?? '',
                multiline: true,
                saveHandler: async (value: string) => {
                    if (!value) {
                        throw new SimpleError({
                            code: 'invalid_field',
                            message: $t('%BH'),
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
                title: $t('%BI'),
                description: $t('%BG'),
                saveText: $t('%1Op'),
                placeholder: $t('%YT'),
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
    if (!await CenteredMessage.confirm($t(`%vS`), $t(`%55`), $t(`%vT`))) {
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
    if (!await CenteredMessage.confirm($t(`%vU`), $t(`%vV`))) {
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
                name: $t(`%vW`),
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
                name: $t(`%CJ`),
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
