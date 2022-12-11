import { ArrayDecoder, AutoEncoder, BooleanDecoder, EnumDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { SimpleError } from "@simonbackx/simple-errors";
import { v4 as uuidv4 } from "uuid";

import { RecordAnswer } from "./RecordAnswer";

export enum RecordType {
    /**
     * Show a checkbox to the user so they can check the value on/off
     * It is possible to add a textarea as soon as the checkbox is selected if the extra property is set.
     */
    Checkbox = "Checkbox",

    /**
     * Select one (or none if not required)
     */
    ChooseOne = "ChooseOne",

    /**
     * Select one, zero or more from a menu
     * The way this is shown will differ depending on the minimum or maximum setting. e.g. when exactly one 
     * item should be selected, we could show it with a dropdown menu
     */
    MultipleChoice = "MultipleChoice",

    /**
     * Small text input
     */
    Text = "Text",

    /**
     * Big text input
     */
    Textarea = "Textarea",

    /**
     * Address input
     */
    Address = "Address",

    Phone = "Phone",
    Email = "Email",
}

export enum RecordWarningType {
    Info = "Info",
    Warning = "Warning",
    Error = "Error",
}

export class RecordWarning extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    @field({ decoder: StringDecoder })
    text = ""

    @field({ decoder: new EnumDecoder(RecordWarningType) })
    type = RecordWarningType.Info

    /**
     * Show a warning if the associated value is falsy
     */
    @field({ decoder: BooleanDecoder })
    inverted = false

    static get sort() {
        return (warning1: RecordWarning, warning2: RecordWarning) => {
            const priority1: string = warning1.type
            const priority2: string = warning2.type

            if (priority1 == RecordWarningType.Error && priority2 == RecordWarningType.Warning ||
                priority1 == RecordWarningType.Warning && priority2 == RecordWarningType.Info ||
                priority1 == RecordWarningType.Error && priority2 == RecordWarningType.Info) {
                return -1;
            }
            else if (priority1 == RecordWarningType.Info && priority2 == RecordWarningType.Warning ||
                priority1 == RecordWarningType.Warning && priority2 == RecordWarningType.Error ||
                priority1 == RecordWarningType.Info && priority2 == RecordWarningType.Error) {
                return 1;
            }
            else {
                return 0;
            }
        };
    }

    get icon() {
        switch (this.type) {
            case RecordWarningType.Error: return " exclamation-two red"
            case RecordWarningType.Warning: return " exclamation yellow"
            case RecordWarningType.Info: return " info-text"
        }
    }
}

export class RecordChoice extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder, version: 118 })
    description = ""

    /**
     * Show a warning if selected (or not selected if inverted)
     */
    @field({ decoder: RecordWarning, version: 122, nullable: true })
    warning: RecordWarning | null = null
}

export class RecordSettings extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    /**
     * Short name (used mainly for displaying the information)
     */
    @field({ decoder: StringDecoder })
    name = ""

    /**
     * When used with checkbox: checkbox needs to get checked (e.g accept terms, confirm age...)
     * Multiple choice: minimum one selection required
     * Text: required input
     */
    @field({ decoder: BooleanDecoder })
    required = false

    /**
     * Whether you need permission to collect this information
     */
    @field({ decoder: BooleanDecoder, version: 123 })
    sensitive = true

    /**
     * @deprecated
     * In some cases, we need to collect some information and store it non-encrypted, in case the keys get lost:
     * examples of this is mainly for storing granted permissions: permission to take pictures, permissions to collect data, ...
     */
    @field({ decoder: BooleanDecoder, optional: true })
    encrypted = false

    /**
     * Only used for checkboxes
     */
    @field({ decoder: BooleanDecoder, version: 119 })
    askComments = false

    /**
     * Future idea:
     * Is this information visible for the member?
     * -> needs some major changes in saving the encryption blobs (needs to get split in two)
     */
    // @field({ decoder: BooleanDecoder })
    // visibleForMembers = true

    @field({ decoder: new EnumDecoder(RecordType) })
    type = RecordType.Text

    /**
     * In case of multiple choice: the values you can choose from with optional additional information
     */
    @field({ decoder: new ArrayDecoder(RecordChoice) })
    choices: RecordChoice[] = []

     /**
     * Label used for input (depending on the type)
     * Checkbox: text next to checkbox
     * Text inputs: label field above the input
     * If empty: name is used
     */
    @field({ decoder: StringDecoder })
    label = ""

    /**
     * Text underneath the label in case of a checkbox.
     * For other types: below the input
     */
    @field({ decoder: StringDecoder })
    description = ""

    /// In case of textboxes or comments for checked checkboxes
    @field({ decoder: StringDecoder })
    inputPlaceholder = ""

    /// Text below the input field for comments (if any)
    @field({ decoder: StringDecoder, version: 120 })
    commentsDescription = ""

    /**
     * Show a warning if selected / entered (or not selected/entered if inverted)
     */
    @field({ decoder: RecordWarning, version: 122, nullable: true })
    warning: RecordWarning | null = null

    validate(answers: RecordAnswer[]): RecordAnswer | undefined {
        const answer = answers.find(a => a.settings.id === this.id)

        if (this.required && !answer) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Dit veld is verplicht",
                field: this.id
            })
        }

        return answer;
    }
}