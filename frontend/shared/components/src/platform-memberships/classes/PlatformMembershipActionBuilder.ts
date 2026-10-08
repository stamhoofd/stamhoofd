import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';

import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { Organization, PlatformMembership } from '@stamhoofd/structures';
import { ExcelExportType } from '@stamhoofd/structures';
import { useContext } from '#hooks/useContext.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import type { TableAction, TableActionSelection } from '#tables/classes/TableAction.ts';
import { AsyncTableAction, MenuTableAction } from '#tables/classes/TableAction.ts';
import { getSelectableWorkbook } from './getSelectableWorkbook';

export function usePlatformMembershipActions() {
    const present = usePresent();
    const context = useContext();
    const owner = useRequestOwner();
    const organization = useOrganization();

    return new PlatformMembershipActionBuilder({
        present,
        context: context.value,
        owner,
        organization: organization.value,
    });
}

export class PlatformMembershipActionBuilder {
    present: ReturnType<typeof usePresent>;
    context: SessionContext;
    owner: any;
    organization: Organization | null;

    constructor(settings: {
        present: ReturnType<typeof usePresent>;
        context: SessionContext;
        owner: any;
        organization?: Organization | null;
    }) {
        this.present = settings.present;
        this.context = settings.context;
        this.owner = settings.owner;
        this.organization = settings.organization ?? null;
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
            icon: 'file-pdf',
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
                    root: AsyncComponent(() => import('@stamhoofd/frontend-excel-export/ExcelExportView.vue'), {
                        type: ExcelExportType.PlatformMemberships,
                        filter: selection.filter,
                        workbook: getSelectableWorkbook(this.organization),
                        configurationId: 'platform-memberships',
                        title: this.getExcelTitle(selection),
                    }),
                }),
            ],
            modalDisplayStyle: 'popup',
        });
    }

    private getExcelTitle(selection: TableActionSelection<PlatformMembership>) {
        if (selection.markedRows && selection.markedRowsAreSelected && selection.markedRows.size === 1) {
            return [...selection.markedRows.values()][0].member.name;
        }
        const parts = [
            $t('%1Nt'),
        ];

        return parts.filter(Boolean).join(' - ');
    }
}
