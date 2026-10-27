import { DocumentSettings, DocumentTemplatePrivate } from './Document.js';
import { RecordTextAnswer } from './members/records/RecordAnswer.js';
import { RecordSettings, RecordType } from './members/records/RecordSettings.js';

describe('document template field-answer filters', () => {
    test('registers configured answer IDs, including dotted IDs', () => {
        const answer = RecordTextAnswer.create({
            settings: RecordSettings.create({ id: 'member.firstName', type: RecordType.Text }),
            value: 'Jane',
        });
        const template = DocumentTemplatePrivate.create({
            year: 2026,
            settings: DocumentSettings.create({ fieldAnswers: new Map([[answer.settings.id, answer]]) }),
        });
        expect(template.doesMatchFilter({ fieldAnswers: { 'member.firstName': { $eq: 'Jane' } } })).toBe(true);
        expect(template.doesMatchFilter({ fieldAnswers: { 'member.firstName': { $eq: 'Other' } } })).toBe(false);
    });
});
