// I18n.ts
import { defineComponent, h, VNode } from 'vue';

type ParsedPart =
    | { type: 'text'; content: string }
    | { type: 'slot'; tag: string; content: string };

function parseTranslation(input: string): ParsedPart[] {
    const regex = /<(\w+)>(.*?)<\/\1>/gs;
    const parts: ParsedPart[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: input.slice(lastIndex, match.index) });
        }

        parts.push({ type: 'slot', tag: match[1], content: match[2] });
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < input.length) {
        parts.push({ type: 'text', content: input.slice(lastIndex) });
    }

    return parts;
}

export default defineComponent({
    name: 'I18nComponent',
    props: {
        t: {
            type: String,
            required: true,
        },
    },
    setup(props, { slots }) {
        const parts = parseTranslation(props.t);

        const children: VNode[] = parts.map((part, index) => {
            if (part.type === 'text') {
                return h('span', { key: index }, part.content);
            }

            const slotFn = slots[part.tag];
            if (slotFn) {
                return slotFn({ content: part.content })[0];
            }
            else {
                return h('span', { key: index }, part.content);
            }
        });

        return () => h('span', {}, children);
    },
});
