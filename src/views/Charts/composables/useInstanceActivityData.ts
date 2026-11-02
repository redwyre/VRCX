import { nextTick, reactive, ref } from 'vue';

import dayjs from 'dayjs';

import { database } from '../../../services/database';
import { getWorldName } from '../../../shared/utils';

export function useInstanceActivityData() {
    const activityData = ref([]);
    const activityDetailData = ref([]);
    const allDateOfActivity = ref(new Set());
    const worldNameArray = ref([]);

    async function getAllDateOfActivity() {
        const utcDateStrings = (await database.getDateOfInstanceActivity()) || [];
        const uniqueDates = new Set();

        for (const utcString of utcDateStrings) {
            const formattedDate = dayjs.utc(utcString).tz().format('YYYY-MM-DD');
            uniqueDates.add(formattedDate);
        }

        allDateOfActivity.value = reactive(uniqueDates);
    }

    async function getWorldNameData() {




        worldNameArray.value = await Promise.all(
            activityData.value.map(async (item) => {
                return await getWorldName((item as any).location);
            })
        );
    }

    async function getActivityData(selectedDate: any, currentUser: any, friends: any, localFavoriteFriends: any, onActivityDetailReady: any) {
        const localStartDate = dayjs.tz(selectedDate.value).startOf('day').toISOString();
        const localEndDate = dayjs.tz(selectedDate.value).endOf('day').toISOString();
        const dbData = await database.getInstanceActivity(localStartDate, localEndDate);

        const transformData = (item: any) => ({
            ...item,
            joinTime: dayjs(item.created_at).subtract(item.time, 'millisecond'),
            leaveTime: dayjs(item.created_at),
            time: item.time < 0 ? 0 : item.time,
            isFriend:
                item.user_id === currentUser.value.id
                    ? null
                    : friends.value.has(item.user_id) || localFavoriteFriends.value.has(item.user_id),
            isFavorite: item.user_id === currentUser.value.id ? null : localFavoriteFriends.value.has(item.user_id)
        });





        activityData.value = dbData.currentUserData.map(transformData);

        const transformAndSort = (arr: any) => {
            return arr.map(transformData).sort((a: any, b: any) => {
                const timeDiff = Math.abs(a.joinTime.diff(b.joinTime, 'second'));
                // recording delay, under 3s is considered the same time entry, beautify the chart
                return timeDiff < 3 ? a.leaveTime - b.leaveTime : a.joinTime - b.joinTime;
            });
        };

        const filterByLocation = (innerArray: any, locationSet: any) => {
            return innerArray.every((innerObject: any) => locationSet.has(innerObject.location));
        };
        const locationSet = new Set(activityData.value.map((item) => (item as any).location));

        const preSplitActivityDetailData = Array.from(dbData.detailData.values())
            .map(transformAndSort)
            .filter((innerArray) => filterByLocation(innerArray, locationSet));

        activityDetailData.value = handleSplitActivityDetailData(preSplitActivityDetailData, currentUser.value.id);

        if (activityDetailData.value.length && onActivityDetailReady) {
            nextTick(() => {
                onActivityDetailReady();
            });
        }
    }

    function handleSplitActivityDetailData(activityDetailData: any, currentUserId: any) {
        function countTargetIdOccurrences(innerArray: any, targetId: any) {
            let count = 0;
            for (const obj of innerArray) {
                if (obj.user_id === targetId) {
                    count++;
                }
            }
            return count;
        }

        function areIntervalsOverlapping(objA: { leaveTime: { isBefore: (arg0: any, arg1: string) => any; }; joinTime: any; }, objB: { joinTime: any; leaveTime: { isBefore: (arg0: any, arg1: string) => any; }; }) {
            const isObj1EndTimeBeforeObj2StartTime = objA.leaveTime.isBefore(objB.joinTime, 'second');
            const isObj2EndTimeBeforeObj1StartTime = objB.leaveTime.isBefore(objA.joinTime, 'second');
            return !(isObj1EndTimeBeforeObj2StartTime || isObj2EndTimeBeforeObj1StartTime);
        }

        function buildOverlapGraph(innerArray: string | any[]) {
            const numObjects = innerArray.length;
            const adjacencyList = Array.from({ length: numObjects }, () => []);

            for (let i = 0; i < numObjects; i++) {
                for (let j = i + 1; j < numObjects; j++) {
                    if (areIntervalsOverlapping(innerArray[i], innerArray[j])) {




                        adjacencyList[i].push(j);




                        adjacencyList[j].push(i);
                    }
                }
            }
            return adjacencyList;
        }

        function depthFirstSearch(nodeIndex: number, visited: any, graph: { [x: string]: any; }, component: any) {
            visited[nodeIndex] = true;
            component.push(nodeIndex);
            for (const neighborIndex of graph[nodeIndex]) {
                if (!visited[neighborIndex]) {
                    depthFirstSearch(neighborIndex, visited, graph, component);
                }
            }
        }

        function findConnectedComponents(graph: any[][], numNodes: number) {
            const visited = new Array(numNodes).fill(false);
            const components = [];

            for (let i = 0; i < numNodes; i++) {
                if (!visited[i]) {
                    const component: any = [];
                    depthFirstSearch(i, visited, graph, component);
                    components.push(component);
                }
            }
            return components;
        }

        function processOuterArrayWithTargetId(outerArray: any, targetId: any) {
            let i = 0;
            while (i < outerArray.length) {
                let currentInnerArray = outerArray[i];
                let targetIdCount = countTargetIdOccurrences(currentInnerArray, targetId);
                if (targetIdCount > 1) {
                    let graph = buildOverlapGraph(currentInnerArray);
                    let connectedComponents = findConnectedComponents(graph, currentInnerArray.length);
                    let newInnerArrays = connectedComponents.map((componentIndices) => {
                        return componentIndices.map((index: string | number) => currentInnerArray[index]);
                    });
                    outerArray.splice(i, 1, ...newInnerArrays);
                    i += newInnerArrays.length;
                } else {
                    i += 1;
                }
            }
            return outerArray.sort((a: { joinTime: number; }[], b: { joinTime: number; }[]) => a[0].joinTime - b[0].joinTime);
        }

        return processOuterArrayWithTargetId(activityDetailData, currentUserId);
    }

    return {
        activityData,
        activityDetailData,
        allDateOfActivity,
        worldNameArray,

        getAllDateOfActivity,
        getWorldNameData,
        getActivityData
    };
}
