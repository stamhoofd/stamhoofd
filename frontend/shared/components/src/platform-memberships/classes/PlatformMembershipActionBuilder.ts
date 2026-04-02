import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { ExcelExportView } from '@stamhoofd/frontend-excel-export';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { PlatformMembership } from '@stamhoofd/structures';
import { ExcelExportType } from '@stamhoofd/structures';
import { useContext } from '../../hooks';
import type { TableAction, TableActionSelection } from '../../tables/classes';
import { AsyncTableAction, MenuTableAction } from '../../tables/classes';
import { getSelectableWorkbook } from './getSelectableWorkbook';

export function usePlatformMembershipActions() {
    const present = usePresent();
    const context = useContext();
    const owner = useRequestOwner();

    return new PlatformMembershipActionBuilder({
        present,
        context: context.value,
        owner,
    });
}

export class PlatformMembershipActionBuilder {
    present: ReturnType<typeof usePresent>;
    context: SessionContext;
    owner: any;

    constructor(settings: {
        present: ReturnType<typeof usePresent>;
        context: SessionContext;
        owner: any;
    }) {
        this.present = settings.present;
        this.context = settings.context;
        this.owner = settings.owner;
    }

    getActions(): TableAction<PlatformMembership>[] {
        const actions = [
        
            this.getExportAction(),
           
        ];

        return actions;
    }

    private getExportAction() {
        return new MenuTableAction({
            name: $t('%17e'),
            icon: 'download',
            priority: 8,
            groupIndex: 3,
            childActions: [
                this.getExportToExcelAction(),
            ],
        });
    }

    private getExportToExcelAction() {
        return new AsyncTableAction({
            name: $t('%17U'),
            priority: 0,
            groupIndex: 0,
            handler: async (selection: TableActionSelection<PlatformMembership>) => {
                await this.exportToExcel(selection);
            },
        });
    }

    async exportToExcel(selection: TableActionSelection<PlatformMembership>) {
        await this.present({
            components: [
                new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(ExcelExportView, {
                        type: ExcelExportType.PlatformMemberships,
                        filter: selection.filter,
                        workbook: getSelectableWorkbook(),
                        configurationId: 'platform-memberships',
                    }),
                }),
            ],
            modalDisplayStyle: 'popup',
        });
    }
}
