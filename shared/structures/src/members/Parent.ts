import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, StringDecoder, SymbolDecoder } from '@simonbackx/simple-encoding';
import { DataValidator, Formatter, StringCompare } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { Address } from '../addresses/Address.js';
import { NationalRegisterNumberOptOut } from './NationalRegisterNumberOptOut.js';
import { ParentType, ParentTypeHelper } from './ParentType.js';

export class Parent extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new EnumDecoder(ParentType) })
    type: ParentType = ParentType.Mother;

    @field({ decoder: StringDecoder })
    firstName = '';

    @field({ decoder: StringDecoder })
    lastName = '';

    @field({ decoder: StringDecoder, version: 348, nullable: true })
    @field({
        decoder: new SymbolDecoder(StringDecoder, NationalRegisterNumberOptOut),
        version: 349,
        nullable: true,
        downgrade: (n: string | typeof NationalRegisterNumberOptOut | null) => n === NationalRegisterNumberOptOut ? null : n,
    })
    nationalRegisterNumber: string | typeof NationalRegisterNumberOptOut | null = null;

    @field({ decoder: StringDecoder, nullable: true })
    phone: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, field: 'mail' })
    @field({ decoder: StringDecoder, nullable: true, version: 5 })
    email: string | null = null;

    @field({ decoder: new ArrayDecoder(StringDecoder), version: 278 })
    alternativeEmails: string[] = [];

    @field({ decoder: Address, nullable: true })
    address: Address | null = null;

    @field({ decoder: DateDecoder, version: 367 })
    createdAt = new Date();

    /**
     * Stores the timestamp the parent was last edited in the UI (not the same as edited in the database - this is used to find the most correct data in case of duplicates)
     */
    @field({ decoder: DateDecoder, nullable: true, version: 367 })
    updatedAt: Date | null = null;

    get name() {
        if (!this.firstName) {
            return this.lastName;
        }
        if (!this.lastName) {
            return this.firstName;
        }
        return this.firstName + ' ' + this.lastName;
    }

    getDiffName() {
        return this.name + ` (${ParentTypeHelper.getName(this.type)})`;
    }

    getEmails() {
        const userEmails = [...this.alternativeEmails];

        if (this.email) {
            userEmails.unshift(this.email);
        }

        return userEmails;
    }

    hasEmail(email: string): boolean {
        const cleaned = email.toLowerCase().trim();
        if (this.email === cleaned) {
            return true;
        }
        return this.alternativeEmails.includes(cleaned);
    }

    /**
     * Call this to clean up capitals in all the available data
     */
    cleanData() {
        if (StringCompare.isFullCaps(this.firstName)) {
            this.firstName = Formatter.capitalizeWords(Formatter.removeDuplicateSpaces(this.firstName.toLowerCase()));
        }
        if (StringCompare.isFullCaps(this.lastName)) {
            this.lastName = Formatter.capitalizeWords(Formatter.removeDuplicateSpaces(this.lastName.toLowerCase()));
        }

        if (this.email) {
            this.email = this.email.toLowerCase().trim();

            if (!DataValidator.isEmailValid(this.email)) {
                this.email = null;
            }
        }

        this.alternativeEmails = Formatter.uniqueArray(this.alternativeEmails.map(e => e.toLowerCase().trim()).filter((email) => {
            if (this.email && email === this.email) {
                return false;
            }
            if (!DataValidator.isEmailValid(email)) {
                return false;
            }

            return true;
        }));

        if (this.phone) {
            this.phone = Formatter.removeDuplicateSpaces(this.phone.trim());
        }

        this.firstName = Formatter.capitalizeFirstLetter(Formatter.removeDuplicateSpaces(this.firstName.trim()));
        this.lastName = Formatter.removeDuplicateSpaces(this.lastName.trim());

        if (this.lastName === this.lastName.toLocaleLowerCase()) {
            // Add auto capitals
            this.lastName = Formatter.capitalizeWords(this.lastName);
        }

        this.address?.cleanData();
    }

    isEqual(other: Parent) {
        this.cleanData();
        other.cleanData();
        return this.firstName === other.firstName && this.lastName === other.lastName && this.email === other.email && this.phone === other.phone && this.address?.toString() === other.address?.toString();
    }

    /**
     * Merge, giving other priority over this
     */
    merge(other: Parent) {
        if (other.firstName.length > 0) {
            this.firstName = other.firstName;
        }
        if (other.lastName.length > 0) {
            this.lastName = other.lastName;
        }
        // note: do not change createdAt
        if (other.updatedAt) {
            this.updatedAt = other.updatedAt;
        }
        this.alternativeEmails = Formatter.uniqueArray([...other.getEmails(), ...this.getEmails()]);

        if (other.email) {
            this.email = other.email;
        }

        if (other.address) {
            this.address = other.address;
        }

        if (other.phone) {
            this.phone = other.phone;
        }

        if (other.type) {
            if (other.type === ParentType.Parent1 || other.type === ParentType.Parent2) {
                // Ignore if current type is also not one of those
                if (this.type === ParentType.Parent1 || this.type === ParentType.Parent2) {
                    this.type = other.type;
                }
            }
            else {
                this.type = other.type;
            }
        }

        if (other.nationalRegisterNumber) {
            this.nationalRegisterNumber = other.nationalRegisterNumber;
        }

        this.cleanData();
    }
}
