import { Address } from './Address.js';

describe('Address', () => {
    test('splitAddressLine', async () => {
        function check([line, [street, number]]: [string, [string, string]]) {
            let splitted!: {number: string, street: string};
            expect(() => {splitted = Address.splitAddressLine(line)}, line).not.toThrow()
            expect(splitted).toEqual({street, number})
        }

        const streets = [
            'Demostraat',
            'Wijk 5',
            'Karel De Brichylaan', // Space
            '11-Novemberstraat', // Space
            '4de Lancierslaan', // Space
            '18 augustuslaan', // Space
            'Plein 1940-1945',
            //'Plein \'40-\'45',
            'Rue des 3 Arbres', // Midden van straat
            'Leopold II-laan'
        ];

        const numbers = [
            '5',
            'z/n',
            's/n',
            '5 bus 10',
            '12 bte 3',
            '12 bte. 3',
            '12 bt. 3',
            '12 boite 3',
            '12 boîte 3',
            '12 box 3',
            '12 bte3',
            '12bte3',
            '12bte 3',
            '12 bus 1.04',
            '12 bus 1/A',
            '12 bus 1A',
            '12 bus A5',
            '12A bus 1/A',
            '12A bus 1A',
            '12A bis bus 1A',
            '12 bus 3',
            '5 001',
            '56/102',
            '54/A',
            '54A',
            '12-14',
            '12 & 14',
            '12 en 14',
            '54-A',
            '1AA/A',
            '54A-A',
            '12bis',
            '12 bis',
            '12 BIS',
            '12 ter',
            '12 quater',
            '12 quater',
            '113B Bis A'
        ]

        for (const street of streets) {
            for (const number of numbers) {
                if (number.match(/^\d/) && !street.match(/\d$/)) {
                    // Missing space detection
                    check([street + '' + number, [street, number]])
                }
                check([street + '      ' + number, [street, number]])
                check([street + ' ' + number, [street, number]])
                check([street + ' ' + number, [street, number]])
                check([street + '  ' + number, [street, number]])
                check([street + '  ' + number, [street, number]])
            }
        }
    });
});
