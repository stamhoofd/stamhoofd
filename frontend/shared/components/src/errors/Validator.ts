

export type Validation = () => Promise<boolean> | boolean
/***
 * Pass a Validator instance to mutliple components so you can validate the state of multiple input components at once. 
 * This is usefull because some validation already happens on the fly in components, that way we can reuse that behaviour
 *  in a final validation before submitting a form.
 * Components are responsible for their own error showing
 */
export class Validator {
    validations: Map<any, Validation> = new Map()

    addValidation(owner: any, validation: Validation) {
        this.validations.set(owner, validation)
    }

    removeValidation(owner: any) {
        this.validations.delete(owner)
    }

    /**
     * Validate all fields
     */
    async validate(): Promise<boolean> {
        let valid = true
        for (const [_, validation] of this.validations) {
            const result = await validation()
            if (!result) {
                valid = false
                // we do not return yet, since validation method can have side effects in UI
            }
        }
        return valid
    }
}
