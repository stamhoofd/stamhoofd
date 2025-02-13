import { ArrayDecoder, AutoEncoder, BooleanDecoder, Data, DateDecoder, Decoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { isSimpleError, SimpleError } from '@simonbackx/simple-errors';
import { DataValidator, Formatter, StringCompare } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { Address } from '../../addresses/Address.js';
import { CountryHelper } from '../../addresses/CountryDecoder.js';
import { Image } from '../../files/Image.js';
import { RecordChoice, RecordSettings, RecordType, RecordWarning, RecordWarningType } from './RecordSettings.js';
import { File } from '../../files/File.js';

export class RecordAnswer extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Settings of this record at the time of input. Depending on the changes, we can auto migrate some settings
     */
    @field({ decoder: RecordSettings })
    settings: RecordSettings;

    /**
     * Date that this was changed. To determine merge order
     */
    @field({ decoder: DateDecoder, version: 128 })
    date: Date = new Date();

    /**
     * Date that this answer was last reviewed by the author
     * -> when editing by the organization, don't set this date
     */
    @field({ decoder: DateDecoder, nullable: true })
    reviewedAt: Date | null = null;

    isOutdated(timeoutMs: number): boolean {
        if (!this.reviewedAt) {
            return true;
        }
        if (this.reviewedAt.getTime() < new Date().getTime() - timeoutMs) {
            return true;
        }
        return false;
    }

    markReviewed() {
        this.reviewedAt = new Date();
    }

    get stringValue() {
        return 'Onbekend';
    }

    get objectValue(): string | number | boolean | null | Date | object {
        return this.stringValue;
    }

    /**
     * Include both the setting and the value
     */
    get descriptionValue() {
        return this.settings.name + ': ' + this.stringValue;
    }

    get excelColumns() {
        return this.settings.excelColumns;
    }

    get excelValues() {
        return [{
            value: this.stringValue,
            format: null,
        }];
    }

    getWarnings(): RecordWarning[] {
        if (!this.isEmpty) {
            try {
                this.validate();
            }
            catch (e) {
                if (isSimpleError(e)) {
                    return [
                        RecordWarning.create({
                            id: 'validation-warning-' + this.id,
                            text: e.getHuman(),
                            type: RecordWarningType.Error,
                        }),
                    ];
                }
                // ignore
            }
        }
        return [];
    }

    validate() {
        // valid by default
    }

    /**
     * Return true when it is not the default value as a general rule
     * E.g. checkbox by default not checked -> empty if not checked
     */
    get isEmpty() {
        return false;
    }

    matchQuery(query: string) {
        return StringCompare.contains(this.stringValue, query);
    }

    isReviewedAfter(answer: RecordAnswer) {
        if (this.reviewedAt && answer.reviewedAt) {
            return this.reviewedAt > answer.reviewedAt;
        }
        if (this.reviewedAt && !answer.reviewedAt) {
            return true;
        }
        if (!this.reviewedAt && answer.reviewedAt) {
            return false;
        }
        // Both null
        return false;
    }

    static createDefaultAnswer(settings: RecordSettings) {
        const type = RecordAnswerDecoder.getClassForType(settings.type);
        return type.create({
            settings,
        });
    }

    getDiffName() {
        return this.settings.name;
    }

    getDiffValue(): unknown {
        return this.stringValue;
    }

    transformForDiff(): unknown {
        return this.stringValue;
    }
}

export class RecordAnswerDecoderStatic implements Decoder<RecordAnswer> {
    decode(data: Data): RecordAnswer {
        const settings = data.field('settings').decode(RecordSettings as Decoder<RecordSettings>);
        const type = settings.type;
        return data.decode(this.getClassForType(type) as Decoder<RecordAnswer>);
    }

    getClassForType(type: RecordType): typeof RecordAnswer {
        switch (type) {
            case RecordType.Checkbox: return RecordCheckboxAnswer;
            case RecordType.Text:
            case RecordType.Phone:
            case RecordType.Email:
            case RecordType.Textarea:
                return RecordTextAnswer;
            case RecordType.MultipleChoice: return RecordMultipleChoiceAnswer;
            case RecordType.ChooseOne: return RecordChooseOneAnswer;
            case RecordType.Address: return RecordAddressAnswer;
            case RecordType.Date: return RecordDateAnswer;
            case RecordType.Price: return RecordPriceAnswer;
            case RecordType.Image: return RecordImageAnswer;
            case RecordType.Integer: return RecordIntegerAnswer;
            case RecordType.File: return RecordFileAnswer;
        }
    }
}
export const RecordAnswerDecoder = new RecordAnswerDecoderStatic();

export class RecordTextAnswer extends RecordAnswer {
    @field({ decoder: StringDecoder, nullable: true })
    value: string | null = null;

    get stringValue() {
        return this.value ?? '/';
    }

    get objectValue() {
        return this.value;
    }

    getWarnings(): RecordWarning[] {
        const base = super.getWarnings();
        if (!this.settings.warning) {
            return base;
        }
        if (this.settings.warning.inverted) {
            return this.value === null || this.value.length === 0 ? [this.settings.warning, ...base] : base;
        }
        return this.value !== null && this.value.length > 0 ? [this.settings.warning, ...base] : base;
    }

    override validate() {
        if (this.settings.required && (this.value === null || this.value.length === 0)) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Dit veld is verplicht',
                field: 'input',
            });
        }

        if (this.value && this.settings.name.toLocaleLowerCase().includes('rijksregisternummer')) {
            if (!DataValidator.verifyBelgianNationalNumber(this.value)) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: "'" + (this.value) + "' is geen geldig rijksregisternummer. Je kan dit nummer vinden op de achterkant van de identiteitskaart, in de vorm van JJ.MM.DD-XXX.XX. Kijk na op typefouten.",
                    field: 'input',
                });
            }

            // Auto format the number
            this.value = DataValidator.formatBelgianNationalNumber(this.value);
        }
    }

    get isEmpty() {
        return (this.value === null || this.value.length === 0);
    }
}

export class RecordCheckboxAnswer extends RecordAnswer {
    @field({ decoder: BooleanDecoder })
    selected = false;

    @field({ decoder: StringDecoder, optional: true })
    comments?: string;

    getWarnings(): RecordWarning[] {
        const base = super.getWarnings();
        if (!this.settings.warning) {
            return base;
        }
        if (this.settings.warning.inverted) {
            return !this.selected ? [this.settings.warning, ...base] : base;
        }
        return this.selected ? [this.settings.warning, ...base] : base;
    }

    get stringValue() {
        return this.selected ? 'Aangevinkt' : 'Niet aangevinkt';
    }

    get objectValue() {
        return this.selected;
    }

    get excelValues() {
        return [{
            value: this.selected ? (this.comments ? this.comments : 'Ja') : 'Nee',
            format: null,
        }];
    }

    override validate() {
        if (this.settings.required && !this.selected) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Dit is verplicht',
                field: 'input',
            });
        }
    }

    get isEmpty() {
        return !this.selected;
    }
}

export class RecordMultipleChoiceAnswer extends RecordAnswer {
    @field({ decoder: new ArrayDecoder(RecordChoice) })
    selectedChoices: RecordChoice[] = [];

    get stringValue() {
        return this.selectedChoices.map(c => c.name).join(', ');
    }

    get objectValue() {
        return this.selectedChoices.map(c => c.id);
    }

    getWarnings(): RecordWarning[] {
        const base = super.getWarnings();
        if (this.selectedChoices.length === 0) {
            return base;
        }

        const warnings: RecordWarning[] = base;

        for (const choice of this.selectedChoices) {
            if (choice.warning && !choice.warning.inverted) {
                warnings.push(choice.warning);
            }
        }

        for (const choice of this.settings.choices) {
            if (choice.warning && choice.warning.inverted) {
                if (!this.selectedChoices.find(s => s.id === choice.id)) {
                    warnings.push(choice.warning);
                }
            }
        }

        return warnings;
    }

    override validate() {
        if (this.settings.required && this.selectedChoices.length === 0) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Duid minstens één keuze aan',
                field: 'input',
            });
        }
    }

    get isEmpty() {
        return this.selectedChoices.length === 0;
    }
}

export class RecordChooseOneAnswer extends RecordAnswer {
    @field({ decoder: RecordChoice, nullable: true })
    selectedChoice: RecordChoice | null = null;

    get stringValue() {
        return this.selectedChoice?.name ?? '/';
    }

    get objectValue() {
        return this.selectedChoice?.id ?? null;
    }

    getWarnings(): RecordWarning[] {
        const base = super.getWarnings();
        if (this.selectedChoice === null) {
            // TODO: show warning if inverted
            return base;
        }

        const warnings: RecordWarning[] = base;

        if (this.selectedChoice.warning && !this.selectedChoice.warning.inverted) {
            warnings.push(this.selectedChoice.warning);
        }

        for (const choice of this.settings.choices) {
            if (choice.warning && choice.warning.inverted) {
                if (this.selectedChoice.id !== choice.id) {
                    warnings.push(choice.warning);
                }
            }
        }

        return warnings;
    }

    override validate() {
        if (this.settings.required && this.selectedChoice === null) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Duid een keuze aan',
                field: 'input',
            });
        }
    }

    get isEmpty() {
        return this.selectedChoice === null;
    }
}

export class RecordAddressAnswer extends RecordAnswer {
    @field({ decoder: Address, nullable: true })
    address: Address | null = null;

    get stringValue() {
        return this.address?.toString() ?? '/';
    }

    get objectValue() {
        return this.address?.encode({ version: 0 }) ?? null;
    }

    override validate() {
        if (this.settings.required && this.address === null) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Verplicht in te vullen',
                field: 'input',
            });
        }
    }

    get excelValues() {
        return [
            {
                value: this.address ? `${this.address.street} ${this.address.number}` : '/',
                format: null,
            },
            {
                value: this.address?.postalCode ?? '/',
                format: null,
            },
            {
                value: this.address?.city ?? '/',
                format: null,
            },
            {
                value: this.address ? CountryHelper.getName(this.address.country) : '/',
                format: null,
            },
        ];
    }

    get isEmpty() {
        return this.address === null;
    }
}

export class RecordDateAnswer extends RecordAnswer {
    @field({ decoder: DateDecoder, nullable: true })
    dateValue: Date | null = null;

    get stringValue() {
        return this.dateValue ? Formatter.dateNumber(this.dateValue, true) : '/';
    }

    get objectValue() {
        return this.dateValue;
    }

    override validate() {
        if (this.settings.required && this.dateValue === null) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Verplicht in te vullen',
                field: 'input',
            });
        }
    }

    get isEmpty() {
        return this.dateValue === null;
    }
}

export class RecordIntegerAnswer extends RecordAnswer {
    @field({ decoder: IntegerDecoder, nullable: true })
    value: number | null = null;

    get stringValue() {
        return this.value !== null ? this.value.toString() : '/';
    }

    get objectValue() {
        return this.value;
    }

    getWarnings(): RecordWarning[] {
        const base = super.getWarnings();
        if (!this.settings.warning) {
            return base;
        }
        if (this.settings.warning.inverted) {
            return this.value === null || this.value === 0 ? [this.settings.warning, ...base] : base;
        }
        return this.value !== null && this.value !== 0 ? [this.settings.warning, ...base] : base;
    }

    override validate() {
        if (this.settings.required && (this.value === null)) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Dit veld is verplicht',
                field: 'input',
            });
        }
    }

    get isEmpty() {
        return (this.value === null);
    }
}

export class RecordPriceAnswer extends RecordIntegerAnswer {
    get stringValue() {
        return this.value !== null ? Formatter.price(this.value) : '/';
    }
}

export class RecordImageAnswer extends RecordAnswer {
    @field({ decoder: Image, nullable: true })
    image: Image | null = null;

    get stringValue() {
        return this.image?.getPublicPath() ?? '/';
    }

    get objectValue() {
        return this.image?.encode({ version: 0 }) ?? null;
    }

    override validate() {
        if (this.settings.required && this.image === null) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Verplicht in te vullen',
                field: 'input',
            });
        }
    }

    get isEmpty() {
        return this.image === null;
    }

    transformForDiff() {
        return this.image;
    }
}

export class RecordFileAnswer extends RecordAnswer {
    @field({ decoder: File, nullable: true })
    file: File | null = null;

    get stringValue() {
        return this.file?.getPublicPath() ?? '/';
    }

    get objectValue() {
        return this.file?.encode({ version: 0 }) ?? null;
    }

    override validate() {
        if (this.settings.required && this.file === null) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Verplicht in te vullen',
                field: 'input',
            });
        }
    }

    get isEmpty() {
        return this.file === null;
    }

    transformForDiff() {
        return this.file;
    }
}
