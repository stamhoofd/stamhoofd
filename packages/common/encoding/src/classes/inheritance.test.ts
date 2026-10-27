import { field } from '../decorators/Field.js';
import StringDecoder from '../structs/StringDecoder.js';
import { AutoEncoder } from './AutoEncoder.js';

describe('Inheriting', () => {
    it('Inherits fields', () => {
        class Animal extends AutoEncoder {
            @field({ decoder: StringDecoder, defaultValue: () => '1' })
            id: string;

            get breed() {
                return 'unknown';
            }
        }

        // Force cache set on animal
        const a = Animal.create({});
        a.encode({ version: 1 });
        Animal.decodeField({}, { version: 1 });

        class Dog extends Animal {
            @field({ decoder: StringDecoder })
            color: string;

            get breed() {
                return 'dog';
            }
        }

        {
            const dog = Dog.create({});
            expect(dog.id).toEqual('1');
            expect(dog.color).toEqual('');
            expect(dog.breed).toEqual('dog');
            expect(dog.encode({ version: 0 })).toStrictEqual({
                id: '1',
            });
        }

        {
            const dog = Dog.create({
                id: '2',
                color: 'black',
            });
            expect(dog.id).toEqual('2');
            expect(dog.color).toEqual('black');
            expect(dog.breed).toEqual('dog');

            expect(dog.encode({ version: 0 })).toStrictEqual({
                id: '2',
                color: 'black',
            });
        }

        {
            const dog = Dog.decodeField({
                id: '2',
                color: 'black',
            }, { version: 0 });
            expect(dog.id).toEqual('2');
            expect(dog.color).toEqual('black');
            expect(dog.breed).toEqual('dog');
        }

        {
            const dog = Dog.decodeField({
                color: 'black',
            }, { version: 0 });
            expect(dog.id).toEqual('1');
            expect(dog.color).toEqual('black');
            expect(dog.breed).toEqual('dog');
        }

        expect(Dog.fields).not.toBe(Animal.fields);
        expect(Dog.__latestFields).not.toBe(Animal.__latestFields);
    });

    it('Override field defaults', () => {
        class Animal extends AutoEncoder {
            @field({ decoder: StringDecoder, defaultValue: () => '1' })
            id: string;

            @field({ decoder: StringDecoder })
            type: string;

            get breed() {
                return 'unknown';
            }
        }

        class Dog extends Animal {
            @field({ decoder: StringDecoder })
            color: string;

            @field({ decoder: StringDecoder })
            type = 'dog';

            get breed() {
                return 'dog';
            }
        }

        // Force cache set on animal
        const a = Animal.create({});
        a.encode({ version: 1 });
        Animal.decodeField({}, { version: 1 });

        {
            const dog = Dog.create({});
            expect(dog.id).toEqual('1');
            expect(dog.color).toEqual('');
            expect(dog.type).toEqual('dog');
            expect(dog.breed).toEqual('dog');
        }

        expect(Dog.fields).not.toBe(Animal.fields);
        expect(Dog.__latestFields).not.toBe(Animal.__latestFields);
    });
});
