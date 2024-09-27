export type Validation = () => Promise<boolean> | boolean;
/***
 * Pass a Validator instance to mutliple components so you can validate the state of multiple input components at once.
 * This is usefull because some validation already happens on the fly in components, that way we can reuse that behaviour
 *  in a final validation before submitting a form.
 * Components are responsible for their own error showing
 */
export class Validator {
    validations: Map<any, Validation> = new Map();
    keyMap: Map<string, Set<any>> = new Map();

    addValidation(owner: any, validation: Validation, key?: string) {
        this.validations.set(owner, validation);
        if (key) {
            const set = this.keyMap.get(key);
            if (set) {
                set.add(owner);
            }
            else {
                this.keyMap.set(key, new Set([owner]));
            }
        }
    }

    removeValidation(owner: any, key?: string) {
        this.validations.delete(owner);

        if (key) {
            const set = this.keyMap.get(key);
            if (set) {
                set.delete(owner);
                if (set.size === 0) {
                    this.keyMap.delete(key);
                }
            }
        }
    }

    /**
     * Validate all fields
     */
    async validate(): Promise<boolean> {
        let valid = true;
        for (const [_, validation] of this.validations) {
            const result = await validation();
            if (!result) {
                valid = false;
                // we do not return yet, since validation method can have side effects in UI
            }
        }
        return valid;
    }

    async validateByKey(key: string): Promise<boolean> {
        const validationKeys = this.keyMap.get(key);
        if (!validationKeys) {
            console.error(`Key ${key} not found.`);
            return false;
        }

        let isValid = true;

        for (const key of validationKeys) {
            const validation = this.validations.get(key);
            if (validation && !await validation()) {
                isValid = false;
            }
        }

        return isValid;
    }
}
