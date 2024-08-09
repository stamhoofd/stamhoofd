import { ColorHelper } from '@stamhoofd/components';
import { Colors, Formatter } from '@stamhoofd/utility';
import type { ObjectDirective } from "vue";

export const ColorDirective: ObjectDirective<HTMLElement> = {
    // called right before the element is inserted into the DOM.
    beforeMount(el, binding) {
        if (!binding.value) {
            return;
        }
        const id = typeof binding.value === "string" ? binding.value : binding.value.id;

        const hue = Formatter.stringToNumber(id, 360);
        const color = Colors.hslToHex({
            h: hue,
            s: 100,
            l: 20
        });
    
        ColorHelper.setColor(color, el)
    }
}
