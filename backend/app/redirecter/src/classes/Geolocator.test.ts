import { Country } from '@stamhoofd/types/Country';
import { Geolocator } from './Geolocator.js';

describe('Geolocator', () => {
    beforeAll(async () => {
        await Geolocator.shared.load(import.meta.dirname + '/../data/belgium.csv', Country.Belgium);
        await Geolocator.shared.load(import.meta.dirname + '/../data/netherlands.csv', Country.Netherlands);
    });

    test('Returns right', async () => {
        const country = Geolocator.shared.getCountry('185.115.216.1');
        expect(country).toEqual(Country.Belgium)
    });

    test('Returns BE for range defined like - in file', async () => {
        const country = Geolocator.shared.getCountry('57.233.0.1');
        expect(country).toEqual(Country.Belgium)
    });

    test('Returns BE ipv6', async () => {
        const country = Geolocator.shared.getCountry('2a02:578:04de:b562:3af1:c074:e829:6d30');
        expect(country).toEqual(Country.Belgium)
    });

    test('Returns NL ipv6', async () => {
        const country = Geolocator.shared.getCountry('2a00:8760:c819:6e52:d301:a84f:7b2e:19cd');
        expect(country).toEqual(Country.Netherlands)
    });

    test('Returns NL ipv4', async () => {
        const country = Geolocator.shared.getCountry('37.72.136.125');
        expect(country).toEqual(Country.Netherlands)
    });
});
