import Location from '@/components/Location.vue';




import { i18n } from '@/plugins';




import { formatDateFilter } from '@/shared/utils';
import { ArrowUpDown } from 'lucide-vue-next';




import { Button } from '@/components/ui/button';

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

export const createColumns = ({ onShowUser }: any) => [
    {
        accessorKey: 'created_at',
        header: ({ column }: any) =>
            sortButton({
                column,
                label: t('dialog.group_member_moderation.created_at')
            }),
        size: 170,




        cell: ({ row }: any) => <span>{formatDateFilter(row.original?.created_at, 'long')}</span>
    },
    {
        accessorKey: 'eventType',
        header: ({ column }: any) =>
            sortButton({
                column,
                label: t('dialog.group_member_moderation.type')
            }),
        size: 190,




        cell: ({ row }: any) => <span>{row.original?.eventType}</span>
    },
    {
        accessorKey: 'actorDisplayName',
        header: ({ column }: any) =>
            sortButton({
                column,
                label: t('dialog.group_member_moderation.display_name')
            }),
        size: 160,
        cell: ({ row }: any) => {
            const original = row.original;
            return (




                <span
                    style="cursor: pointer"
                    onClick={(e: { stopPropagation: () => void; }) => {
                        e.stopPropagation();
                        onShowUser?.(original?.actorId);
                    }}
                >




                    <span>{original?.actorDisplayName}</span>




                </span>
            );
        }
    },
    {
        id: 'description',
        accessorFn: (row: { description: any; }) => row?.description ?? '',
        header: () => t('dialog.group_member_moderation.description'),
        meta: {
            stretch: true
        },
        cell: ({ row }: any) => {
            const original = row.original;
            const targetId = original?.targetId ?? '';
            return (




                <span>
                    {typeof targetId === 'string' && targetId.startsWith('wrld_') ? (
                        <Location location={targetId} />
                    ) : null}




                    <span>{original?.description}</span>




                </span>
            );
        }
    },
    {
        id: 'data',
        header: () => t('dialog.group_member_moderation.data'),
        enableSorting: false,
        cell: ({ row }: any) => {
            const original = row.original;
            const data = original?.data;
            const hasData = data && typeof data === 'object' && Object.keys(data).length;




            return <span>{hasData ? JSON.stringify(data) : ''}</span>;
        }
    }
];
