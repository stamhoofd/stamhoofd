import { nextTick } from 'vue';

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

        // Because the async validation can cause Vue performance issues (a validator updates a value -> vue update caused due to async validation so all the updates don't happen in one go)
        // we need to be very careful with async validation and try to perform them in one go.
        const promises: Promise<boolean>[] = [];
        for (const [_, validation] of this.validations) {
            const result = validation();

            if (typeof result === 'boolean') {
                if (!result) {
                    valid = false;
                    // we do not return yet, since validation method can have side effects in UI
                }
            }
            else {
                promises.push(result);
            }
        }

        if (promises.length > 0) {
            const results = await Promise.all(promises);
            valid = valid && results.every(r => r);
        }

        // Process vue updates before returning value
        await nextTick();
        return valid;
    }

    async validateByKey(key: string): Promise<boolean> {
        const validationKeys = this.keyMap.get(key);
        if (!validationKeys) {
            // No validators for this key, which means it is valid
            return true;
        }

        let isValid = true;

        for (const key of validationKeys) {
            const validation = this.validations.get(key);
            if (validation && !await validation()) {
                isValid = false;
            }
        }

        await nextTick();
        return isValid;
    }
}
