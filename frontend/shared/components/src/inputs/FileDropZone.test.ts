import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-vue';
import { userEvent } from 'vitest/browser';
import FileDropZone from './FileDropZone.vue';

function renderZone(props: { dragging?: boolean; loading?: boolean; disabled?: boolean } = {}) {
    const onSelect = vi.fn();
    render(FileDropZone, {
        props: { title: 'Sleep het bestand hierheen', accept: 'application/pdf', ...props },
        attrs: { onSelect },
    });
    return { onSelect };
}

function zone() {
    return document.querySelector<HTMLElement>('.file-drop-zone')!;
}

function input() {
    return zone().querySelector<HTMLInputElement>('input[type="file"]')!;
}

test('Hands over the file that was picked, and lets the same file be picked again', async () => {
    const { onSelect } = renderZone();
    const pdf = new File([new Uint8Array(10)], 'uittreksel.pdf', { type: 'application/pdf' });

    expect(input().accept).toBe('application/pdf');

    await userEvent.upload(input(), pdf);

    await vi.waitFor(() => {
        expect(onSelect).toHaveBeenCalledTimes(1);
    });
    expect((onSelect.mock.calls[0][0] as File).name).toBe(pdf.name);
    expect(input().value).toBe('');
});

test('Lights up while the parent says a file is dragged over it', () => {
    renderZone({ dragging: true });

    expect(zone().classList.contains('dragging')).toBe(true);
});

test('Takes no file while it is loading, and shows a spinner instead of its icon', () => {
    renderZone({ loading: true });

    expect(input().disabled).toBe(true);
    expect(zone().classList.contains('disabled')).toBe(true);
    expect(zone().querySelector('.spinner')).not.toBeNull();
    expect(zone().querySelector('.icon.upload')).toBeNull();
});

test('Takes no file while it is disabled', () => {
    renderZone({ disabled: true });

    expect(input().disabled).toBe(true);
    expect(zone().classList.contains('disabled')).toBe(true);
    expect(zone().querySelector('.icon.upload')).not.toBeNull();
});
