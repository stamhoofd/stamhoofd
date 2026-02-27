import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { useRequestOwner } from '@stamhoofd/networking';
import { BaseOrganization, Event, EventNotification, EventNotificationType, Platform } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useContext } from '#hooks/useContext';
import { usePatch } from '#hooks/usePatch';

export class EventNotificationViewModel {
    isNew: boolean;
    eventNotification: EventNotification;

    /**
     * Dependency is required to easily calculate the current type information of the event notification.
     */
    platform: Platform;

    /**
     * Callback handler when the event notification is saved.
     */
    saveHandler?: (viewModel: EventNotificationViewModel) => Promise<void>;

    /**
     * Internal state (not using # because this doesn't work in Vue as these are not exposed in proxies)
     */
    isSaving = false;

    constructor({ isNew, eventNotification, saveHandler, platform }: { isNew: boolean; eventNotification: EventNotification; saveHandler?: typeof EventNotificationViewModel.prototype.saveHandler; platform: Platform }) {
        this.isNew = isNew;
        this.eventNotification = eventNotification;
        this.saveHandler = saveHandler;
        this.platform = platform;
    }

    static createNew({ events, typeId, saveHandler, platform, organization }: { organization: BaseOrganization; events: Event[]; typeId: string; saveHandler?: typeof EventNotificationViewModel.prototype.saveHandler; platform: Platform }) {
        return new EventNotificationViewModel({
            isNew: true,
            eventNotification: EventNotification.create({
                events,
                typeId,
                organization: BaseOrganization.create(organization),
            }),
            saveHandler,
            platform,
        });
    }

    static edit({ eventNotification, saveHandler, platform }: { eventNotification: EventNotification; saveHandler?: typeof EventNotificationViewModel.prototype.saveHandler; platform: Platform }) {
        return new EventNotificationViewModel({
            isNew: false,
            eventNotification,
            saveHandler,
            platform,
        });
    }

    useNotification() {
        return computed(() => this.eventNotification);
    }

    useOriginalNotification() {
        return computed(() => this.eventNotification.patch({
            recordAnswers: this.eventNotification.acceptedRecordAnswers,
        }));
    }

    get type() {
        return this.platform.config.eventNotificationTypes.find(t => t.id === this.eventNotification.typeId) ?? EventNotificationType.create({ title: $t(`bd1e59c8-3d4c-4097-ab35-0ce7b20d0e50`) });
    }

    useType() {
        return computed(() => this.type);
    }

    usePatch() {
        const notification = this.useNotification();
        return usePatch(notification);
    }

    /**
     * This is a hook so we can access request owner, context etc to make the save request.
     */
    useSave() {
        const context = useContext();
        const owner = useRequestOwner();

        return {
            save: async (patch: AutoEncoderPatchType<EventNotification>) => {
                if (this.isSaving) {
                    throw new SimpleError({
                        code: 'saving',
                        message: $t('3f34c1d2-0305-432f-b789-7d334a7c093b'),
                    });
                }
                this.isSaving = true;

                try {
                    const arr = new PatchableArray();
                    if (this.isNew) {
                        arr.addPut(this.eventNotification.patch(patch));
                    }
                    else {
                        patch.id = this.eventNotification.id;
                        arr.addPatch(patch);
                    }

                    const server = context.value.getAuthenticatedServerForOrganization(this.eventNotification.organization.id);

                    const response = await server.request({
                        method: 'PATCH',
                        path: '/event-notifications',
                        body: arr,
                        decoder: new ArrayDecoder(EventNotification as Decoder<EventNotification>),
                        owner,
                        shouldRetry: false,
                    });

                    if (response.data.length === 0) {
                        throw new SimpleError({
                            code: 'not_found',
                            message: 'Event notification not found',
                        });
                    }

                    const put = response.data[0];

                    this.eventNotification.deepSet(put);
                    this.isNew = false;

                    if (this.saveHandler) {
                        await this.saveHandler(this);
                    }
                    return Promise.resolve();
                }
                finally {
                    this.isSaving = false;
                }
            },
            deleteModel: async () => {
                if (this.isSaving) {
                    throw new SimpleError({
                        code: 'saving',
                        message: $t('3f34c1d2-0305-432f-b789-7d334a7c093b'),
                    });
                }
                this.isSaving = true;

                try {
                    const arr = new PatchableArray();
                    if (this.isNew) {
                        return;
                    }
                    arr.addDelete(this.eventNotification.id);

                    const server = context.value.getAuthenticatedServerForOrganization(this.eventNotification.organization.id);

                    await server.request({
                        method: 'PATCH',
                        path: '/event-notifications',
                        body: arr,
                        decoder: new ArrayDecoder(EventNotification as Decoder<EventNotification>),
                        owner,
                        shouldRetry: false,
                    });

                    this.isNew = true;
                    return Promise.resolve();
                }
                finally {
                    this.isSaving = false;
                }
            },
            isSaving: computed(() => this.isSaving),
        };
    }
}
