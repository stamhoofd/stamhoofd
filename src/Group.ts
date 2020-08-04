import { AutoEncoder, field, IntegerDecoder,StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

import { GroupPrivateSettings } from './GroupPrivateSettings';
import { GroupSettings, WaitingListType } from './GroupSettings';

export class Group extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: IntegerDecoder })
    cycle = 0

    @field({ decoder: GroupSettings })
    settings: GroupSettings

    /**
     * Only set when you have access to this information
     */
    @field({ decoder: GroupPrivateSettings, nullable: true, version: 10 })
    privateSettings: GroupPrivateSettings | null = null

    static defaultSort(this: unknown, a: Group, b: Group) {
        if (a.settings.maxAge && !b.settings.maxAge) {
            return -1
        }
        if (b.settings.maxAge && !a.settings.maxAge) {
            return 1
        }
        if (!b.settings.maxAge && !a.settings.maxAge) {
            // name
            return Group.nameSort(a, b)
        }
        if (a.settings.maxAge! > b.settings.maxAge!) {
            return 1
        }
        if (a.settings.maxAge! < b.settings.maxAge!) {
            return -1
        }
        return Group.nameSort(a, b)
    }

    static nameSort(this: unknown, a: Group, b: Group) {
        if (a.settings.name.toLowerCase() < b.settings.name.toLowerCase()) {
            return -1
        }
        if (a.settings.name.toLowerCase() > b.settings.name.toLowerCase()) {
            return 1
        }
        return 0
    }

    /**
     * Return the pre registration date only if is is active right now
     */
    get activePreRegistrationDate() {
        if (this.settings.waitingListType !== WaitingListType.PreRegistrations) {
            return null
        }
        if (this.settings.startDate < new Date()) {
            // Start date is in the past: registrations are open
            return null
        }
        return this.settings.startDate
    }

    /**
     * Returns true if we need to know if it is a new member before we can know if a group is valid. Else you can default to false
     */
    shouldKnowExisting() {
        // Check if group has waiting list
        if (this.settings.waitingListType == WaitingListType.None) {
            return false;
        }

        if (this.settings.waitingListType == WaitingListType.All) {
            return false;
        }

        if (this.settings.waitingListType == WaitingListType.PreRegistrations) {
            if (this.settings.startDate < new Date()) {
                // end of pre registration date: it doesn't matter anymore
                return false;
            }

            // We need to know it
            return true;
        }

        if (this.settings.waitingListType == WaitingListType.ExistingMembersFirst) {
            return true
        }

        return true
    }

    /**
     * Returns if a user can register in this group (also true if waiting list). Throws errors if not possible
     */
    canRegisterInGroup(isExistingMember: boolean) {
        const preRegistrationDate = this.activePreRegistrationDate
        if (preRegistrationDate && !isExistingMember) {
            throw new SimpleError({
                code: "",
                message: "Momenteel zijn de voorinschrijvingen nog bezig voor deze leeftijdsgroep. Enkel bestaande leden kunnen inschrijven, vanaf "+Formatter.date(preRegistrationDate)+" kunnen ook nieuwe leden inschrijven."
            })
        }

        const now = new Date()

        if (this.settings.startDate > now && (!preRegistrationDate || preRegistrationDate < now)) {
            if (preRegistrationDate) {
                throw new SimpleError({
                    code: "",
                    message: "De inschrijvingen voor deze leeftijdsgroep beginnen pas vanaf "+Formatter.date(this.settings.startDate)+". De voorinschrijvingen beginnen op "+Formatter.date(preRegistrationDate)
                })
            }
            throw new SimpleError({
                code: "",
                message: "De inschrijvingen voor deze leeftijdsgroep beginnen pas vanaf "+Formatter.date(this.settings.startDate)
            })
        }

        if (this.settings.endDate < now) {
            throw new SimpleError({
                code: "",
                message: "De inschrijvingen voor deze groep zijn gesloten"
            })
        }
    }

    /**
     * Use this during registration to check if we need to register for waiting list
     */
    isWaitingList(isExistingMember: boolean): boolean {
        switch (this.settings.waitingListType) {
            case WaitingListType.None: return false;
            case WaitingListType.ExistingMembersFirst: return !isExistingMember;
            case WaitingListType.All: return true;
            case WaitingListType.PreRegistrations: return false;
        }
    }

}

export const GroupPatch = Group.patchType()