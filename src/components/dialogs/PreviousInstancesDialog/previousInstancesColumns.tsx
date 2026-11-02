import { ArrowUpDown, Info, LogIn, Trash2 } from 'lucide-vue-next';

import DisplayName from '../../DisplayName.vue';
import Location from '../../Location.vue';
import LocationWorld from '../../LocationWorld.vue';
import { Button } from '../../ui/button';
import { i18n } from '../../../plugins';
import { formatDateFilter } from '../../../shared/utils';

const { t } = i18n.global;

const sortButton = ({ column, label, descFirst = false }: any) => (
    <Button
        variant="ghost"
        size="sm"
        class="-ml-2 h-8 px-2"
        onClick={() => {
            const sorted = column.getIsSorted();
            if (!sorted && descFirst) {
                column.toggleSorting(true);
                return;
            }
            column.toggleSorting(sorted === 'asc');
        }}
    >
        {label}
        <ArrowUpDown class="ml-1 h-4 w-4" />
    </Button>
);

const resolveBool = (maybeRef: { value: any; }) => {
    if (maybeRef && typeof maybeRef === 'object' && 'value' in maybeRef) {
        return !!maybeRef.value;
    }
    return !!maybeRef;
};

const baseDateColumn = () => ({
    id: 'created_at',
    accessorFn: (row: { created_at: string; }) => (row?.created_at ? Date.parse(row.created_at) : 0),
    size: 170,
    header: ({ column }: any) =>
        sortButton({
            column,
            label: t('table.previous_instances.date'),
            descFirst: true
        }),




    cell: ({ row }: any) => <span>{formatDateFilter(row.original?.created_at, 'long')}</span>
});

const timeColumn = () => ({
    id: 'time',
    accessorFn: (row: { time: any; }) => row?.time ?? 0,
    size: 100,
    header: ({ column }: any) => sortButton({ column, label: t('table.previous_instances.time') }),




    cell: ({ row }: any) => <span>{row.original?.timer ?? ''}</span>
});

const actionsColumn = ({ shiftHeld, onShowInfo, onDelete, onDeletePrompt, onLaunch = null }: any) => ({
    id: 'actions',
    enableSorting: false,
    size: onLaunch ? 140 : 120,
    header: () => t('table.previous_instances.action'),
    meta: {
        thClass: 'text-right',
        tdClass: 'text-right'
    },
    cell: ({ row }: any) => {
        const original = row.original;
        const isShiftHeld = resolveBool(shiftHeld);

        return (




            <div class="inline-flex items-center justify-end gap-1">
                {onLaunch ? (
                    <Button
                        size="icon-sm"
                        variant="ghost"
                        class="w-6 h-6 text-xs"
                        onClick={(event: { stopPropagation: () => void; }) => {
                            event.stopPropagation();
                            onLaunch?.(original?.location);
                        }}
                    >
                        <LogIn class="h-4 w-4" />
                    </Button>
                ) : null}

                <Button
                    size="icon-sm"
                    variant="ghost"
                    class="w-6 h-6 text-xs"
                    onClick={(event: { stopPropagation: () => void; }) => {
                        event.stopPropagation();
                        onShowInfo?.(original?.$location?.tag);
                    }}
                >
                    <Info class="h-4 w-4" />
                </Button>

                <Button
                    size="icon-sm"
                    variant="ghost"
                    class="w-6 h-6 text-xs"
                    style={isShiftHeld ? { color: '#f56c6c' } : undefined}
                    onClick={(event: { stopPropagation: () => void; }) => {
                        event.stopPropagation();
                        if (isShiftHeld) {
                            onDelete?.(original);
                        } else {
                            onDeletePrompt?.(original);
                        }
                    }}
                >
                    <Trash2 class="h-4 w-4" />
                </Button>




            </div>
        );
    }
});

export const createPreviousInstancesColumns = (variant: string, config: { shiftHeld: any; onLaunch: any; onShowInfo: any; onDelete: any; onDeletePrompt: any; currentUserId: any; forceUpdateKey: any; }) => {
    if (variant === 'user') {
        return [
            baseDateColumn(),
            {
                id: 'world',
                accessorFn: (row: { worldName: any; name: any; }) => row?.worldName ?? row?.name ?? '',
                header: ({ column }: any) =>
                    sortButton({
                        column,
                        label: t('table.previous_instances.world')
                    }),
                meta: {
                    stretch: true
                },
                cell: ({ row }: any) => (
                    <Location
                        location={row.original?.location}
                        hint={row.original?.worldName}
                        grouphint={row.original?.groupName}
                    />
                )
            },
            {
                id: 'creator',
                accessorFn: (row: { $location: { userId: any; }; }) => row?.$location?.userId ?? '',
                size: 170,
                header: () => t('table.previous_instances.instance_creator'),
                cell: ({ row }: any) => (
                    <DisplayName userid={row.original?.$location?.userId} location={row.original?.$location?.tag} />
                )
            },
            timeColumn(),
            actionsColumn({
                shiftHeld: config.shiftHeld,
                onLaunch: config.onLaunch,
                onShowInfo: config.onShowInfo,
                onDelete: config.onDelete,
                onDeletePrompt: config.onDeletePrompt
            })
        ];
    }

    if (variant === 'world') {
        return [
            baseDateColumn(),
            {
                id: 'instance',
                accessorFn: (row: { $location: { tag: any; }; location: any; }) => row?.$location?.tag ?? row?.location ?? '',
                header: () => t('table.previous_instances.instance_name'),
                meta: {
                    stretch: true
                },
                cell: ({ row }: any) => (
                    <LocationWorld
                        class="w-fit"
                        locationobject={row.original?.$location}
                        grouphint={row.original?.groupName}
                        currentuserid={config.currentUserId}
                    />
                )
            },
            {
                id: 'creator',
                accessorFn: (row: { $location: { userId: any; }; }) => row?.$location?.userId ?? '',
                size: 170,
                header: () => t('table.previous_instances.instance_creator'),
                cell: ({ row }: any) => (
                    <DisplayName
                        userid={row.original?.$location?.userId}
                        location={row.original?.$location?.tag}
                        forceUpdateKey={config.forceUpdateKey}
                    />
                )
            },
            timeColumn(),
            actionsColumn({
                shiftHeld: config.shiftHeld,
                onShowInfo: config.onShowInfo,
                onDelete: config.onDelete,
                onDeletePrompt: config.onDeletePrompt
            })
        ];
    }

    return [
        baseDateColumn(),
        {
            id: 'instance',
            accessorFn: (row: { worldName: any; name: any; }) => row?.worldName ?? row?.name ?? '',
            header: () => t('table.previous_instances.instance_name'),
            meta: {
                stretch: true
            },
            cell: ({ row }: any) => (
                <Location
                    location={row.original?.$location?.tag ?? row.original?.location}
                    grouphint={row.original?.groupName}
                    hint={row.original?.worldName}
                />
            )
        },
        timeColumn(),
        actionsColumn({
            shiftHeld: config.shiftHeld,
            onShowInfo: config.onShowInfo,
            onDelete: config.onDelete,
            onDeletePrompt: config.onDeletePrompt
        })
    ];
};
