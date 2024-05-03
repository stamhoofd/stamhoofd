import { reactive } from "vue";
import {Storage} from "@stamhoofd/networking"

export function useCollapsed(globalIdentifier: string) {
    const collapsedSections = reactive(new Set<string>())

    const load = async () => {
        try {
            const value = await Storage.keyValue.getItem("collapsed-"+globalIdentifier)
            if (value) {
                const values = JSON.parse(value);
                for (const value of values) {
                    collapsedSections.add(value)
                }
            }
        } catch (e) {
            console.error(e)
        }
    }

    const save = async () => {
        try {
            const values = [...collapsedSections.values()]
            await Storage.keyValue.setItem("collapsed-"+globalIdentifier, JSON.stringify(values))
        } catch (e) {
            console.error(e)
        }
    }

    load().catch(console.error)

    return {
        toggle(id: string) {
            if (collapsedSections.has(id)) {
                collapsedSections.delete(id);
                save().catch(console.error)
            } else {
                collapsedSections.add(id);
                save().catch(console.error)
            }
        },
        isCollapsed(id: string) {
            return collapsedSections.has(id);
        }
    };
}