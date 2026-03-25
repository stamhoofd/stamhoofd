import { Colors, Formatter } from '@stamhoofd/utility';
import type { ObjectDirective } from 'vue';
import { ColorHelper } from '../ColorHelper.ts';

export const ColorDirective: ObjectDirective<HTMLElement, string | {id: string}> = {
    // called right before the element is inserted into the DOM.
    beforeMount(el, binding) {
        if (!binding.value) {
            return;
        }
        const id: string = typeof binding.value === 'string' ? binding.value : binding.value.id;
        el.classList.add('st-color-directive'); // Fixes dark mode colors

        if (id.startsWith('#')) {
            return ColorHelper.setColor(id, el)
        }

        const hue = Formatter.stringToNumber(id, 360);
        const color = Colors.hslToHex({
            h: hue,
            s: 100,
            l: 20
        });
    
        ColorHelper.setColor(color, el)
    }
}
