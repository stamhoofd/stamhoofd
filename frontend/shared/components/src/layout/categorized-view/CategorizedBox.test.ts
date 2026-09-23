import { expect, test } from 'vitest';
import { render } from 'vitest-browser-vue';
import { defineComponent, h, nextTick } from 'vue';
import Title from '../../members/components/edit/Title.vue';
import CategorizedBox from './CategorizedBox.vue';

function renderTitle({ inBox, level }: { inBox: boolean; level: number }) {
    const title = () => h(Title, { title: 'Child title', level }, {
        right: () => h('button', { 'data-testid': 'right-button', 'type': 'button' }, 'Toggle'),
    });

    render(defineComponent({
        setup: () => () => inBox ? h(CategorizedBox, { title: 'Box title', icon: 'user' }, { default: title }) : title(),
    }));
}

test('a level 0 title inside a CategorizedBox renders its buttons in the box header', async () => {
    renderTitle({ inBox: true, level: 0 });
    await nextTick();
    await nextTick();

    const header = document.querySelector('.categorized-box > h2');
    expect(header?.textContent).toContain('Box title');
    expect(header?.querySelector('[data-testid="right-button"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Child title');
});

test('a level 2 title inside a CategorizedBox keeps its own heading and buttons', async () => {
    renderTitle({ inBox: true, level: 2 });
    await nextTick();
    await nextTick();

    const header = document.querySelector('.categorized-box > h2');
    expect(header?.querySelector('[data-testid="right-button"]')).toBeNull();

    const own = Array.from(document.querySelectorAll('h2')).find(el => el.textContent?.includes('Child title'));
    expect(own?.querySelector('[data-testid="right-button"]')).not.toBeNull();
});

test('a level 0 title outside a CategorizedBox renders nothing', async () => {
    renderTitle({ inBox: false, level: 0 });
    await nextTick();

    expect(document.querySelector('[data-testid="right-button"]')).toBeNull();
    expect(document.body.textContent).not.toContain('Child title');
});
