import { ArrowUpDown, EyeOff, User, UserMinus } from 'lucide-vue-next';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';

import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { TooltipWrapper } from '../../components/ui/tooltip';
import { i18n } from '../../plugins';
import {
    formatDateFilter,
    getFaviconUrl,
    languageClass,
    openExternalLink,
    sortStatus,
    statusClass,
    timeToText
} from '../../shared/utils';

const { t } = i18n.global;

const sortButton = ({ column, label, descFirst = false }: any) => {
    const resolvedLabel = typeof label === 'function' ? label() : label;
    return (
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
            {resolvedLabel}
            <ArrowUpDown class="ml-1 h-4 w-4" />
        </Button>
    );
};

const compareNumbers = (a: any, b: any) => (a ?? 0) - (b ?? 0);

const sortAlphabetically = (a: any, b: any) => {
    if (!a || !b) {
        if (!a && !b) return 0;
        return !a ? -1 : 1;
    }
    return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
};

const sortLanguages = (a: any, b: any) => {
    const as = Array.isArray(a) ? a.map((i) => i.value).sort() : [];
    const bs = Array.isArray(b) ? b.map((i) => i.value).sort() : [];
    return JSON.stringify(as).localeCompare(JSON.stringify(bs));
};

const withFriendNumber = (rowA: { original: { $friendNumber: any; }; }, rowB: { original: any; }, result: number) => {
    if (result !== 0) {
        return result;
    }
    return compareNumbers(rowA.original?.$friendNumber, rowB.original?.$friendNumber);
};

const sortByNumber = (selector: { (row: any): any; (row: any): any; (row: any): any; (row: any): any; (row: any): any; (arg0: any): any; }) => (rowA: any, rowB: any) =>
    withFriendNumber(rowA, rowB, compareNumbers(selector(rowA.original), selector(rowB.original)));

const sortByString = (selector: { (row: any): any; (row: any): any; (row: any): any; (row: any): any; (row: any): any; (arg0: any): any; }) => (rowA: any, rowB: any) =>
    withFriendNumber(rowA, rowB, sortAlphabetically(selector(rowA.original), selector(rowB.original)));

const sortByStatus = (rowA: any, rowB: { original: { status: string; }; }) => {
    const a = rowA.original?.status ?? 'offline';
    const b = rowB.original?.status ?? 'offline';
    return withFriendNumber(rowA, rowB, sortStatus(a, b));
};

const sortByLanguages = (rowA: any, rowB: { original: { $languages: any; }; }) =>
    withFriendNumber(rowA, rowB, sortLanguages(rowA.original?.$languages, rowB.original?.$languages));

export const createColumns = ({
    randomUserColours,
    selectedFriends,
    onToggleFriendSelection,
    onConfirmDeleteFriend,
    userImage,
    friendProfiles
}: any) => {
    const cols = [];

    cols.push(
        {
            id: 'leftSpacer',
            header: () => null,
            size: 20,
            enableSorting: false,
            enableResizing: false,
            meta: {
                thClass: 'p-0',
                tdClass: 'p-0'
            },
            cell: () => null
        },
        {
            id: 'bulkSelect',
            header: () => null,
            size: 55,
            enableSorting: false,
            meta: {
                thClass: 'p-0',
                tdClass: 'p-0'
            },
            cell: ({ row }: any) => {
                const id = row.original?.id;
                const checked = selectedFriends?.value?.has?.(id);
                return (




                    <div class="flex items-center justify-center" onClick={(event: { stopPropagation: () => any; }) => event.stopPropagation()}>
                        <Checkbox modelValue={checked} onUpdate:modelValue={() => onToggleFriendSelection?.(id)} />




                    </div>
                );
            }
        },
        {
            id: 'friendNumber',
            accessorFn: (row: { $friendNumber: any; }) => row?.$friendNumber,
            header: ({ column }: any) =>
                sortButton({
                    column,
                    label: () => t('table.friendList.no'),
                    descFirst: true
                }),
            size: 100,
            meta: { label: () => t('table.friendList.no') },
            sortFn: sortByNumber((row: { $friendNumber: any; }) => row?.$friendNumber ?? 0),




            cell: ({ row }: any) => <span>{row.original?.$friendNumber || ''}</span>
        },
        {
            id: 'avatar',
            accessorFn: (row: { photo: any; }) => row?.photo,
            header: () => t('table.friendList.avatar'),
            size: 90,
            enableSorting: false,
            meta: { label: () => t('table.friendList.avatar') },
            cell: ({ row }: any) => {
                const src = userImage(row.original, true);
                return (




                    <div class="flex items-center">
                        <Avatar class="size-6 rounded-full">
                            <AvatarImage src={src} class="friends-list-avatar object-cover" loading="lazy" />
                            <AvatarFallback>
                                <User class="size-3 text-muted-foreground" />
                            </AvatarFallback>
                        </Avatar>




                    </div>
                );
            }
        },
        {
            id: 'displayName',
            accessorFn: (row: { displayName: any; }) => row?.displayName,
            header: ({ column }: any) =>
                sortButton({
                    column,
                    label: () => t('table.friendList.displayName')
                }),
            size: 200,
            meta: { label: () => t('table.friendList.displayName') },
            sortFn: sortByString((row: { displayName: any; }) => row?.displayName ?? ''),
            cell: ({ row }: any) => {
                const style = randomUserColours?.value ? { color: row.original?.$userColour } : null;
                return (




                    <span class="name" style={style}>
                        {row.original?.displayName ?? ''}




                    </span>
                );
            }
        },
        {
            id: 'rank',
            accessorFn: (row: { $trustSortNum: any; }) => row?.$trustSortNum,
            header: ({ column }: any) =>
                sortButton({
                    column,
                    label: () => t('table.friendList.rank')
                }),
            size: 140,
            meta: { label: () => t('table.friendList.rank') },
            sortFn: sortByNumber((row: { $trustSortNum: any; }) => row?.$trustSortNum ?? 0),
            cell: ({ row }: any) => {
                if (randomUserColours?.value) {




                    return <span class={row.original?.$trustClass}>{row.original?.$trustLevel ?? ''}</span>;
                }
                return (




                    <span class="name" style={{ color: row.original?.$userColour }}>
                        {row.original?.$trustLevel ?? ''}




                    </span>
                );
            }
        },
        {
            id: 'status',
            accessorFn: (row: { status: any; }) => row?.status,
            header: ({ column }: any) =>
                sortButton({
                    column,
                    label: () => t('table.friendList.status')
                }),
            minSize: 200,
            sortFn: sortByStatus,
            meta: {
                stretch: true,
                label: () => t('table.friendList.status')
            },
            cell: ({ row }: any) => {
                const status = row.original?.status;
                return (




                    <span class="flex items-center">
                        {status && status !== 'offline' ? (




                            <i class={['x-user-status', statusClass(status), 'mr-1']}></i>
                        ) : null}




                        <span>{row.original?.statusDescription ?? ''}</span>




                    </span>
                );
            }
        },
        {
            id: 'language',
            accessorFn: (row: { $languages: any; }) => row?.$languages,
            header: ({ column }: any) =>
                sortButton({
                    column,
                    label: () => t('table.friendList.language')
                }),
            size: 130,
            meta: { label: () => t('table.friendList.language') },
            sortFn: sortByLanguages,
            cell: ({ row }: any) => (




                <div class="flex items-center">
                    {(row.original?.$languages ?? []).map((item: { key: string; value: any; }) => (
                        <TooltipWrapper key={item.key} side="top" content={`${item.value} (${item.key})`}>




                            <span class={['flags', 'inline-block', 'mr-1', languageClass(item.key)]}></span>
                        </TooltipWrapper>
                    ))}




                </div>
            )
        },
        {
            id: 'bioLink',
            header: () => t('table.friendList.bioLink'),
            size: 130,
            enableSorting: false,
            meta: { label: () => t('table.friendList.bioLink') },
            cell: ({ row }: any) => (




                <div class="flex items-center">
                    {(friendProfiles.value.get(row.original?.id)?.bioLinks ?? []).filter(Boolean).map((link: string, index: any) => (
                        <TooltipWrapper key={index} content={String(link)}>




                            <img
                                src={getFaviconUrl(link)}
                                class="h-4 w-4 mr-1 align-middle cursor-pointer"
                                onClick={(event: { stopPropagation: () => void; }) => {
                                    event.stopPropagation();
                                    openExternalLink(link);
                                }}
                                loading="lazy"
                            />
                        </TooltipWrapper>
                    ))}




                </div>
            )
        },
        {
            id: 'joinCount',
            accessorFn: (row: { $joinCount: any; }) => row?.$joinCount,
            header: ({ column }: any) =>
                sortButton({
                    column,
                    label: () => t('table.friendList.joinCount')
                }),
            size: 120,
            sortFn: sortByNumber((row: { $joinCount: any; }) => row?.$joinCount ?? 0),
            meta: {
                class: 'text-right',
                label: () => t('table.friendList.joinCount')
            }
        },
        {
            id: 'timeTogether',
            accessorFn: (row: { $timeSpent: any; }) => row?.$timeSpent,
            header: ({ column }: any) =>
                sortButton({
                    column,
                    label: () => t('table.friendList.timeTogether')
                }),
            size: 140,
            sortFn: sortByNumber((row: { $timeSpent: any; }) => row?.$timeSpent ?? 0),
            meta: {
                class: 'text-right',
                label: () => t('table.friendList.timeTogether')
            },
            cell: ({ row }: any) => {
                const time = row.original?.$timeSpent;




                return time ? <span>{timeToText(time)}</span> : null;
            }
        },
        {
            id: 'lastSeen',
            accessorFn: (row: { $lastSeen: any; }) => row?.$lastSeen,
            header: ({ column }: any) =>
                sortButton({
                    column,
                    label: () => t('table.friendList.lastSeen')
                }),
            size: 170,
            meta: { label: () => t('table.friendList.lastSeen') },
            sortFn: sortByString((row: { $lastSeen: any; }) => row?.$lastSeen ?? ''),
            cell: ({ row }: any) => {
                const text = formatDateFilter(row.original?.$lastSeen, 'long');




                return <span>{text === '-' ? '' : text}</span>;
            }
        },
        {
            id: 'mutualFriends',
            accessorFn: (row: { $mutualCount: any; }) => row?.$mutualCount,
            header: ({ column }: any) =>
                sortButton({
                    column,
                    label: () => t('table.friendList.mutualFriends')
                }),
            size: 120,
            sortFn: sortByNumber((row: { $mutualCount: any; }) => row?.$mutualCount ?? 0),
            meta: {
                class: 'text-right',
                label: () => t('table.friendList.mutualFriends')
            },
            cell: ({ row }: any) => {
                const count = row.original?.$mutualCount;
                const optedOut = row.original?.$mutualOptedOut;
                if (!count && !optedOut) return null;
                return (




                    <span class="inline-flex items-center gap-1">
                        {count || null}
                        {optedOut ? (
                            <TooltipWrapper side="top" content={t('table.friendList.mutualOptedOut')}>
                                <EyeOff class="h-3.5 w-3.5 text-muted-foreground" />
                            </TooltipWrapper>
                        ) : null}




                    </span>
                );
            }
        },
        {
            id: 'lastActivity',
            accessorFn: (row: { last_activity: any; }) => row?.last_activity,
            header: ({ column }: any) =>
                sortButton({
                    column,
                    label: () => t('table.friendList.lastActivity')
                }),
            size: 200,
            meta: { label: () => t('table.friendList.lastActivity') },
            sortFn: sortByString((row: { last_activity: any; }) => row?.last_activity ?? ''),




            cell: ({ row }: any) => <span>{formatDateFilter(row.original?.last_activity, 'long')}</span>
        },
        {
            id: 'lastLogin',
            accessorFn: (row: { last_login: any; }) => row?.last_login,
            header: ({ column }: any) =>
                sortButton({
                    column,
                    label: () => t('table.friendList.lastLogin')
                }),
            size: 200,
            meta: { label: () => t('table.friendList.lastLogin') },
            sortFn: sortByString((row: { last_login: any; }) => row?.last_login ?? ''),




            cell: ({ row }: any) => <span>{formatDateFilter(row.original?.last_login, 'long')}</span>
        },
        {
            id: 'dateJoined',
            accessorFn: (row: { date_joined: any; }) => row?.date_joined,
            header: ({ column }: any) =>
                sortButton({
                    column,
                    label: () => t('table.friendList.dateJoined')
                }),
            size: 120,
            meta: { label: () => t('table.friendList.dateJoined') },
            sortFn: sortByString((row: { date_joined: any; }) => row?.date_joined ?? ''),




            cell: ({ row }: any) => <span>{row.original?.date_joined ?? ''}</span>
        },
        {
            id: 'unfriend',
            header: () => t('table.friendList.unfriend'),
            size: 100,
            enableSorting: false,
            meta: {
                class: 'text-center',
                label: t('table.friendList.unfriend')
            },
            cell: ({ row }: any) => (
                // TODO(icon): verify unfollow icon replacement
                <UserMinus
                    class="h-4 w-4 text-destructive inline-block"
                    onClick={(event) => {
                        event.stopPropagation();
                        onConfirmDeleteFriend?.(row.original?.id);
                    }}
                />
            )
        }
    );

    return cols;
};
