import { EventNotification, Event, Platform, EventNotificationType } from '@stamhoofd/structures';
import { usePatch, usePlatform } from '../../../hooks';
import { computed } from 'vue';
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';

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

    constructor({ isNew, eventNotification, saveHandler, platform }: { isNew: boolean; eventNotification: EventNotification; saveHandler?: typeof EventNotificationViewModel.prototype.saveHandler; platform: Platform }) {
        this.isNew = isNew;
        this.eventNotification = eventNotification;
        this.saveHandler = saveHandler;
        this.platform = platform;
    }

    static createNew({ events, typeId, saveHandler, platform }: { events: Event[]; typeId: string; saveHandler?: typeof EventNotificationViewModel.prototype.saveHandler; platform: Platform }) {
        return new EventNotificationViewModel({
            isNew: true,
            eventNotification: EventNotification.create({
                events,
                typeId,
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

    get type() {
        return this.platform.config.eventNotificationTypes.find(t => t.id === this.eventNotification.typeId) ?? EventNotificationType.create({ title: 'Onbekend' });
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
        //
        return async (patch: AutoEncoderPatchType<EventNotification>) => {
            this.eventNotification = this.eventNotification.patch(patch);

            // save the event notification to the database
            if (this.saveHandler) {
                await this.saveHandler(this);
            }
            return Promise.resolve();
        };
    }
}
