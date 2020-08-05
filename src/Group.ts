import { AutoEncoder, field, IntegerDecoder,StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";

import { GroupPrivateSettings } from './GroupPrivateSettings';
import { GroupSettings, WaitingListType } from './GroupSettings';
import { MemberExistingStatus } from './members/MemberDetails';

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
        return this.settings.preRegistrationsDate
    }

    /**
     * Returns true if we need to know if it is a new member or a brother / siter before we can know if a group is valid. Else you can default to false
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

            if (this.settings.preRegistrationsDate !== null && this.settings.preRegistrationsDate < new Date()) {
                // Pre registrations have started
                return true;
            }
            // Pre registrations haven't started yet
            return false
        }

        if (this.settings.waitingListType == WaitingListType.ExistingMembersFirst) {
            // Existing members join the start date
            return true
        }

        return false
    }

    /**
     * Returns if a user can register in this group (also true if waiting list). Throws errors if not possible
     */
    canRegisterInGroup(existingStatus: MemberExistingStatus | null = null) {
        const preRegistrationDate = this.activePreRegistrationDate
        if (preRegistrationDate) {
            // Pre registrations are active
            if (existingStatus === null || existingStatus.isExpired()) {
                throw new SimpleError({
                    code: "missing_existing_status",
                    message: "Hmm... Er ging iets mis. Normaal hadden we je ergens moeten vragen of je al een bestaand lid aan het inschrijven bent. We hebben deze informatie nodig om verder te kunnen gaan. Contacteer ons als je het probleem niet kan oplossen."
                })
            }

            if (existingStatus.isNew) {
                if (existingStatus.hasFamily) {
                    if (!this.settings.priorityForFamily) {
                        throw new SimpleError({
                            code: "",
                            message: "Momenteel zijn de voorinschrijvingen nog bezig voor deze leeftijdsgroep. Enkel bestaande leden kunnen inschrijven, vanaf "+Formatter.date(this.settings.startDate)+" kunnen ook nieuwe leden inschrijven."
                        })
                    } else {
                        // okay
                    }
                } else {
                    if (this.settings.priorityForFamily) {
                        throw new SimpleError({
                            code: "",
                            message: "Momenteel zijn de voorinschrijvingen nog bezig voor deze leeftijdsgroep. Enkel bestaande leden en hun broers/zussen kunnen momenteel inschrijven, vanaf "+Formatter.date(this.settings.startDate)+" kunnen ook nieuwe leden inschrijven."
                        })
                    } else {
                        throw new SimpleError({
                            code: "",
                            message: "Momenteel zijn de voorinschrijvingen nog bezig voor deze leeftijdsgroep. Enkel bestaande leden kunnen inschrijven, vanaf "+Formatter.date(this.settings.startDate)+" kunnen ook nieuwe leden of broers/zussen inschrijven."
                        })
                    }
                }
            }
        }

        const now = new Date()

        if (this.settings.startDate > now && (!preRegistrationDate || preRegistrationDate < now)) {
            if (preRegistrationDate) {
                if (this.settings.priorityForFamily) {
                    throw new SimpleError({
                        code: "",
                        message: "De inschrijvingen voor deze leeftijdsgroep beginnen pas vanaf "+Formatter.date(this.settings.startDate)+". De voorinschrijvingen beginnen op "+Formatter.date(preRegistrationDate)+" voor bestaande leden en hun broers/zussen"
                    })
                } else {
                    throw new SimpleError({
                        code: "",
                        message: "De inschrijvingen voor deze leeftijdsgroep beginnen pas vanaf "+Formatter.date(this.settings.startDate)+". De voorinschrijvingen beginnen op "+Formatter.date(preRegistrationDate)+" voor bestaande leden"
                    })
                }
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
    isWaitingList(existingStatus: MemberExistingStatus | null = null): boolean {
        switch (this.settings.waitingListType) {
            case WaitingListType.None: return false;
            case WaitingListType.ExistingMembersFirst: return existingStatus === null || (existingStatus.isNew && (!this.settings.priorityForFamily || !existingStatus.hasFamily));
            case WaitingListType.All: return true;
            case WaitingListType.PreRegistrations: return false;
        }
    }

}

export const GroupPatch = Group.patchType()