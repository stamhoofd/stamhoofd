export type DefaultLocalesDict = Record<
    string,
    {
        /**
         * A record where the key is the default country that will be used for the translations for the countries in the array.
         * For example: if the key is CO and the array is ["CO", "MX"] this means that Colombia is the default country for Colombia and Mexico.
         */
        countries?: Record<string, string[]>;
        // The default country for all other countries that are not in the countries array.
        default: string;
    }
>;
