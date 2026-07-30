import { expect, test } from 'vitest';
import { printRecoveryCodes, renderRecoveryCodesDocument } from '#auth/printRecoveryCodes.ts';

function renderDocument(codes: string[]): Document {
    const doc = document.implementation.createHTMLDocument();
    renderRecoveryCodesDocument(doc, codes);
    return doc;
}

test('prints every recovery code', () => {
    const codes = ['aaaa-1111', 'bbbb-2222', 'cccc-3333'];
    const doc = renderDocument(codes);

    expect([...doc.querySelectorAll('code')].map(c => c.textContent)).toEqual(codes);
});

test('has a title, an explanation and the print date', () => {
    const doc = renderDocument(['aaaa-1111']);

    // The browser uses the title as the header of the printed page
    expect(doc.title).toBe('Herstelcodes');
    expect(doc.body.textContent).toContain('Bewaar dit blad op een veilige plaats');
    expect(doc.body.textContent).toContain('Afgedrukt op');
});

test('does not depend on the styles of the app', () => {
    const doc = renderDocument(['aaaa-1111']);

    const style = doc.head.querySelector('style');
    expect(style?.textContent).toContain('.codes code');
});

test('printing multiple times does not stack up hidden frames', () => {
    // Note: the print dialog itself is never shown in a headless browser
    printRecoveryCodes(['aaaa-1111']);
    printRecoveryCodes(['bbbb-2222']);

    expect(document.querySelectorAll('[data-testid="recovery-codes-print-frame"]').length).toBeLessThanOrEqual(1);
});
