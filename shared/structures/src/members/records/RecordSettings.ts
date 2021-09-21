import { ArrayDecoder, AutoEncoder, EnumDecoder, field, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

export enum RecordType {
    /**
     * Show a checkbox to the user so they can check the value on/off
     * It is possible to add a textarea as soon as the checkbox is selected if the extra property is set.
     */
    Checkbox = "Checkbox",

    /**
     * Select one, zero or more from a menu (wih a given minimum and maximum setting)
     * The way this is shown will differ depending on the minimum or maximum setting. e.g. when exactly one 
     * item should be selected, we could show it with a dropdown menu
     */
    MultipleChoice = "MultipleChoice",

    /**
     * Text input (big or small) with optional custom validation
     */
    Text = "Text",
}

export enum RecordValidation {
    /**
     * No validation, except checking if string is non empty if input is required
     */
    None = "None",
    Phone = "Phone",
    Address = "Address",
}

export class RecordChoice extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    @field({ decoder: StringDecoder })
    name = ""
}

export class RecordSettings extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string

    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: StringDecoder })
    description = ""

    @field({ decoder: new EnumDecoder(RecordType) })
    type = RecordType.Checkbox

    /**
     * In case of multiple choice: the values you can choose from with optional additional information
     */
    @field({ decoder: new ArrayDecoder(RecordChoice) })
    choices: RecordChoice[] = []
}