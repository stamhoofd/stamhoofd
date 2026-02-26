import { Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { useContext } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { CountResponse, StamhoofdFilter } from '@stamhoofd/structures';

export function useChargeCount(path: string) {
    const context = useContext();
    const owner = useRequestOwner();

    const count = async (filter: StamhoofdFilter): Promise<number | null> => {
        Request.cancelAll(owner);

        try {
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path,
                query: {
                    filter: JSON.stringify(filter),
                },
                decoder: CountResponse as Decoder<CountResponse>,
                owner,
            });

            return response.data.count;
        }
        catch (error) {
            console.error(error);
        }

        return null;
    };

    return {
        count,
    };
}
