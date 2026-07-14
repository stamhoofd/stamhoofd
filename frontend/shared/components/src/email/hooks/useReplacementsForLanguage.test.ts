import { EmailTemplate, EmailTemplateType, Replacement } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Language } from '@stamhoofd/types/Language';
import { expect, test, vi } from 'vitest';
import { ref } from 'vue';
import { useReplacementsForLanguage } from './useReplacementsForLanguage';

// The tests run with the digit locales: %13Z is the example first name ('Jan' in nl, 'Jean' in fr)
function enableMultipleLanguages() {
    TestUtils.setEnvironment('locales', { BE: [Language.Dutch, Language.French, Language.English] });
}

test('the interface language is used while no language is being edited', () => {
    enableMultipleLanguages();
    const language = ref<Language | null>(null);
    const replacements = useReplacementsForLanguage({
        language: () => language.value,
        build: () => [Replacement.create({ token: 'firstName', value: $t('%13Z') })],
    });
    expect(replacements.value[0].value).toBe('Jan');
});

test('the values are rebuilt in the language that is being edited', async () => {
    enableMultipleLanguages();
    const language = ref<Language | null>(null);
    const replacements = useReplacementsForLanguage({
        language: () => language.value,
        build: () => [Replacement.create({ token: 'firstName', value: $t('%13Z') })],
    });

    language.value = Language.French;
    await vi.waitFor(() => expect(replacements.value[0].value).toBe('Jean'));

    // Back to the interface language
    language.value = Language.Dutch;
    await vi.waitFor(() => expect(replacements.value[0].value).toBe('Jan'));
});

test('the supported template replacements follow the language that is being edited', async () => {
    enableMultipleLanguages();
    const language = ref<Language | null>(null);
    const replacements = useReplacementsForLanguage({
        language: () => language.value,
        // The same replacements the email template editor shows for a members email
        build: () => [...EmailTemplate.getSupportedReplacementsForType(EmailTemplateType.SavedMembersEmail)],
    });
    // %13h is the example member first name ('Klaas' in nl, 'Luc' in fr)
    expect(replacements.value.find(r => r.token === 'firstNameMember')?.value).toBe('Klaas');

    language.value = Language.French;
    await vi.waitFor(() => expect(replacements.value.find(r => r.token === 'firstNameMember')?.value).toBe('Luc'));
});

test('build changes while a language is being edited keep that language', async () => {
    enableMultipleLanguages();
    const language = ref<Language | null>(null);
    const token = ref('firstName');
    const replacements = useReplacementsForLanguage({
        language: () => language.value,
        build: () => [Replacement.create({ token: token.value, value: $t('%13Z') })],
    });

    language.value = Language.French;
    await vi.waitFor(() => expect(replacements.value[0].value).toBe('Jean'));

    token.value = 'otherToken';
    await vi.waitFor(() => expect(replacements.value[0]).toMatchObject({ token: 'otherToken', value: 'Jean' }));
});
