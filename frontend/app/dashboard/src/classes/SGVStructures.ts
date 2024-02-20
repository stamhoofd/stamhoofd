import { ArrayDecoder, AutoEncoder, BooleanDecoder, Decoder, field, IntegerDecoder, ObjectData, StringDecoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { Country, CountryDecoder, MemberWithRegistrations } from '@stamhoofd/structures';
import { Formatter, StringCompare } from '@stamhoofd/utility';

export class SGVFoutDecoder implements Decoder<SimpleError> {

    decode(data: ObjectData): SimpleError {
        const message = data.field("beschrijving").string
        const field = data.optionalField("veld")?.string
        return new SimpleError({
            code: "SGVError",
            message,
            field,
        })
        
    }
    
}

export class SGVFoutenDecoder implements Decoder<SimpleErrors> {
    decode(data: ObjectData): SimpleErrors {
        // Support multiple random error formats
        const fouten = data.optionalField("fouten")
        if (fouten) {
            const arr = fouten.array(new SGVFoutDecoder())
            if (arr.length > 0) {
                return new SimpleErrors(...arr)
            }
        }

        const msg = data.optionalField("msg")?.string

        if (msg) {
            return new SimpleErrors(new SimpleError({
                code: "SGVError",
                message: msg
            }))
        }

        const titel = data.optionalField("titel")?.string ?? data.optionalField("boodschap")?.string

        if (!titel) {
            console.error("Onbekende foutmelding van de groepsadministratie: ", data.data)
            
            try {
                return new SimpleErrors(new SimpleError({
                    code: "SGVError",
                    message: "De groepsadministratie gaf een onbekende foutmelding terug aan Stamhoofd: "+JSON.stringify(data.data)
                }))
            } catch (e) {
                return new SimpleErrors(new SimpleError({
                    code: "SGVError",
                    message: "De groepsadministratie gaf een onbekende foutmelding terug aan Stamhoofd. Kijk even na of er niet ergens foutieve gegevens ingevuld staan, dat de groepsadministratie online is en dat je zelf wel deze leden kan bewerken in de groepsadministratie."
                }))
            }
            
        }
        const beschrijving = data.optionalField("beschrijving")?.string
        return new SimpleErrors(new SimpleError({
            code: "SGVError",
            message: titel + (beschrijving ? (": " + beschrijving) : "")
        }))
    }
}

export class SGVMemberError extends Error {
    member: MemberWithRegistrations | SGVLid
    error: Error

    constructor(member: MemberWithRegistrations | SGVLid, error: Error) {
        super(error.message);
        this.member = member
        this.error = error
    }
}

export interface SGVLidMatch {
    stamhoofd: MemberWithRegistrations;
    sgvId: string;
}

export interface SGVLidMatchVerify {
    stamhoofd: MemberWithRegistrations;
    sgv: SGVLid | SGVZoekLid;
    verify: boolean;
}

export class SGVLid {
    id: string;
    firstName: string;
    lastName: string;
    lidNummer: string;
    birthDay: Date;

    constructor(object: {
        id: string;
        firstName: string;
        lastName: string;
        lidNummer: string;
        birthDay: Date;
    }) {
        this.id = object.id
        this.firstName = object.firstName
        this.lastName = object.lastName
        this.birthDay = object.birthDay
        this.lidNummer = object.lidNummer
    }

    static decode(data: ObjectData) {
        const date = data.field("waarden").field("be.vvksm.groepsadmin.model.column.GeboorteDatumColumn").string
        
        const splitted = date.split("/")
        if (splitted.length != 3) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Expected DD/MM/YYYY formatted string",
                field: data.addToCurrentField("waarden.be.vvksm.groepsadmin.model.column.GeboorteDatumColumn")
            })
        }

        const year = parseInt(splitted[2])
        const month = parseInt(splitted[1])
        const day = parseInt(splitted[0])

        if (isNaN(year) || isNaN(month) || isNaN(day) || day > 31 || month > 12 || year > 2200 || year < 1900) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Expected DD/MM/YYYY formatted string",
                field: data.addToCurrentField("waarden.be.vvksm.groepsadmin.model.column.GeboorteDatumColumn")
            })
        }

        return new SGVLid({
            id: data.field("id").string,
            firstName: data.field("waarden").field("be.vvksm.groepsadmin.model.column.VoornaamColumn").string,
            lastName: data.field("waarden").field("be.vvksm.groepsadmin.model.column.AchternaamColumn").string,
            birthDay: new Date(year, month-1, day, 12),
            lidNummer: data.field("waarden").field("be.vvksm.groepsadmin.model.column.LidNummerColumn").string,
        })
    }

    isEqual(member: MemberWithRegistrations) {
        if (!member.details?.birthDay) {
            return false
        }

        if (member.details.memberNumber && this.lidNummer && member.details.memberNumber === this.lidNummer) {
            return true
        }

        return StringCompare.typoCount(member.details.firstName+" "+member.details.lastName, this.firstName+" "+this.lastName) == 0 && StringCompare.typoCount(Formatter.dateNumber(member.details.birthDay), Formatter.dateNumber(this.birthDay)) == 0 
    }

    /// Typo in name
    isProbablyEqual(member: MemberWithRegistrations) {
        if (!member.details?.birthDay) {
            return false
        }

        if (member.details.memberNumber && this.lidNummer) {
            return member.details.memberNumber === this.lidNummer
        }
        
        const t = StringCompare.typoCount(member.details.firstName+" "+member.details.lastName, this.firstName+" "+this.lastName)
        const y = StringCompare.typoCount(Formatter.dateNumber(member.details.birthDay), Formatter.dateNumber(this.birthDay))

        if (t + y <= 3 && y <= 0 && t < 0.4*Math.min(this.firstName.length + this.lastName.length, member.details.firstName.length+member.details.lastName.length)) {
            return true;
        }
        return false;
    }

    // Typo in name or birthday
    isProbablyEqualLastResort(member: MemberWithRegistrations) {
        const t = StringCompare.typoCount(member.details!.firstName+" "+member.details!.lastName, this.firstName+" "+this.lastName)

        if (t <= 2 && t < 0.4*Math.min(this.firstName.length + this.lastName.length, member.details!.firstName.length+member.details!.lastName.length)) {
            return true;
        }
        return false;
    }
}


export class SGVZoekLid extends AutoEncoder {
    @field({ decoder: StringDecoder })
        id: string;

    @field({ decoder: StringDecoder, field: "voornaam" })
        firstName: string;

    @field({ decoder: StringDecoder, field: "achternaam" })
        lastName: string;

    @field({ decoder: StringDecoder, field: "geboortedatum" }) // format 1995-08-20
        birthDayString: string;

    get birthDay() {
        const splitted = this.birthDayString.split("-")
        if (splitted.length != 3) {
            return new Date();
        }

        const year = parseInt(splitted[0])
        const month = parseInt(splitted[1])
        const day = parseInt(splitted[2])

        if (isNaN(year) || isNaN(month) || isNaN(day) || day > 31 || month > 12 || year > 2200 || year < 1900) {
            return new Date();
        }

        return new Date(year, month-1, day, 12);
    }

    // No typeos
    isEqual(member: MemberWithRegistrations) {
        if (!member.details?.birthDay) {
            return false
        }

        return StringCompare.typoCount(member.details.firstName+" "+member.details.lastName, this.firstName+" "+this.lastName) == 0 && StringCompare.typoCount(Formatter.dateNumber(member.details.birthDay), Formatter.dateNumber(this.birthDay)) == 0 
    }

    /// typo in name
    isProbablyEqual(member: MemberWithRegistrations) {
        if (!member.details?.birthDay) {
            return false
        }
        
        const t = StringCompare.typoCount(member.details.firstName+" "+member.details.lastName, this.firstName+" "+this.lastName)
        const y = StringCompare.typoCount(Formatter.dateNumber(member.details.birthDay), Formatter.dateNumber(this.birthDay))

        if (t + y <= 3 && y <= 0 && t < 0.4*Math.min(this.firstName.length + this.lastName.length, member.details.firstName.length+member.details.lastName.length)) {
            return true;
        }
        return false;
    }

    /// typo in name or birthdate
    isProbablyEqualLastResort(member: MemberWithRegistrations) {
        if (!member.details?.birthDay) {
            return false
        }

        const t = StringCompare.typoCount(member.details!.firstName+" "+member.details!.lastName, this.firstName+" "+this.lastName)
        const y = StringCompare.typoCount(Formatter.dateNumber(member.details.birthDay), Formatter.dateNumber(this.birthDay))

        if (t <= 2 && y <= 2 && t < 0.4*Math.min(this.firstName.length + this.lastName.length, member.details!.firstName.length+member.details!.lastName.length)) {
            return true;
        }
        return false;
    }
}

export class SGVZoekenResponse extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(SGVZoekLid) })
        leden: SGVZoekLid[];
}

export class SGVLedenResponse extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
        aantal: number;

    @field({ decoder: IntegerDecoder })
        offset: number;

    @field({ decoder: IntegerDecoder })
        totaal: number;

    @field({ decoder: new ArrayDecoder(SGVLid) })
        leden: SGVLid[];
}

export class SGVAdres extends AutoEncoder {
    @field({ decoder: StringDecoder })
        id: string;

    @field({ decoder: CountryDecoder })
        land: Country;

    @field({ decoder: StringDecoder })
        postcode: string;

    @field({ decoder: StringDecoder })
        gemeente: string;

    @field({ decoder: StringDecoder })
        straat: string;

    @field({ decoder: StringDecoder })
        nummer: string;

    @field({ decoder: StringDecoder })
        telefoon: string;

    @field({ decoder: BooleanDecoder })
        postadres: boolean;
}

export class SGVGroep extends AutoEncoder {
    @field({ decoder: StringDecoder })
        id: string;

    @field({ decoder: StringDecoder })
        groepsnummer: string;

    @field({ decoder: StringDecoder })
        naam: string;

    @field({ decoder: new ArrayDecoder(SGVAdres) })
        adressen: SGVAdres[];
}


export class SGVGroepResponse extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(SGVGroep) })
        groepen: SGVGroep[];
}


export class SGVFunctie extends AutoEncoder {
    @field({ decoder: StringDecoder })
        id: string;

    @field({ decoder: StringDecoder })
        beschrijving: string;

    @field({ decoder: StringDecoder })
        type: string;

    @field({ decoder: new ArrayDecoder(StringDecoder) })
        groepen: string[];

    @field({ decoder: StringDecoder, optional: true })
        code?: string;
}

export class SGVGFunctieResponse extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(SGVFunctie) })
        functies: SGVFunctie[];
}