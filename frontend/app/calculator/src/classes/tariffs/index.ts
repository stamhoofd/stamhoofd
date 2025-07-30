import { TariffDefinition } from '../TariffDefinition';
import { EventbriteTariffs } from './eventbrite';
import { OrdolioTariffs } from './ordolio';
import { StamhoofdTariffs } from './stamhoofd';
import { TwizzitTariffs } from './twizzit';
import { WeticketTariffs } from './weticket';

export const AllPlatforms: TariffDefinition[] = [
    StamhoofdTariffs,
    WeticketTariffs,
    OrdolioTariffs,
    EventbriteTariffs,
    TwizzitTariffs,
];
