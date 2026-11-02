import type { Instance, InstanceShortNameResponse, SentNotification } from 'vrchat';
import type { InstanceCount, Json, VrcxUpdateInstanceRequest } from '../types/vrcx';
import { toast } from 'vue-sonner';

import { i18n } from '../plugins/i18n';
import { request } from '../services/request';
import { useInstanceStore } from '../stores';
import { Component } from 'vue';

const instanceReq = {
    getInstance(params: {
        worldId: string;
        instanceId: string;
    }): Promise<{ json: Json<Instance>; ref: Json<Instance>; params: { worldId: string; instanceId: string } }> {
        const instanceStore = useInstanceStore();
        return request(`instances/${params.worldId}:${params.instanceId}`, {
            method: 'GET'
        }).then((json: object) => {
            return {
                json,
                params,
                ref: instanceStore.applyInstance(json)
            };
        });
    },

    createInstance(params: any): Promise<{ json: Json<Instance>; params: any }> {
        const instanceStore = useInstanceStore();
        return request('instances', {
            method: 'POST',
            params
        }).then((json: object) => {
            const args = {
                json,
                params,
                ref: instanceStore.applyInstance(json)
            };
            return args;
        });
    },

    getInstanceShortName(instance: { worldId: string; instanceId: string; shortName?: string }): Promise<{
        json: Json<InstanceShortNameResponse>;
        instance: { worldId: string; instanceId: string };
        params?: { shortName?: string };
    }> {
        const params: { shortName?: string } = {};
        if (instance.shortName) {
            params.shortName = instance.shortName;
        }
        return request(`instances/${instance.worldId}:${instance.instanceId}/shortName`, {
            method: 'GET',
            params
        }).then((json: any) => {
            const args = {
                json,
                instance,
                params
            };
            return args;
        });
    },

    getInstanceFromShortName(params: { shortName: string }): Promise<{ json: Json<Instance>; params: any }> {
        const instanceStore = useInstanceStore();
        return request(`instances/s/${params.shortName}`, {
            method: 'GET'
        }).then((json: object) => {
            const args = {
                json,
                params,
                ref: instanceStore.applyInstance(json)
            };
            return args;
        });
    },

    selfInvite(instance: {
        worldId: string;
        instanceId: string;
        shortName?: string;
    }): Promise<{ instance: any; json: Json<SentNotification>; params: any }> {
        const params: { shortName?: string } = {};
        if (instance.shortName) {
            params.shortName = instance.shortName;
        }
        return request(`invite/myself/to/${instance.worldId}:${instance.instanceId}`, {
            method: 'POST',
            params
        })
            .then((json: any) => {
                return {
                    json,
                    instance,
                    params
                };
            })
            .catch((err: { error: { message: string | (() => string | Component) | Component; }; }) => {
                if (err?.error?.message) {
                    toast.error(err.error.message);
                    throw err;
                }
                toast.error(i18n.global.t('message.instance.not_allowed'));
                throw err;
            });
    },

    getInstanceCount(): Promise<{ json: InstanceCount }> {
        return request('instances/count', {
            method: 'GET'
        }).then((json: any) => {
            return {
                json
            };
        });
    },

    updateInstance(params: VrcxUpdateInstanceRequest): Promise<{ json: Json<Instance>; params: any; ref: any }> {
        const instanceStore = useInstanceStore();
        const { location, ...body } = params;
        return request(`instances/${location}`, {
            method: 'PUT',
            params: body
        }).then((json: object) => {
            return {
                json,
                params,
                ref: instanceStore.applyInstance(json)
            };
        });
    },

    instanceAnnouncement(params: {
        location: string;
        title: string;
        message: string;
        imageId?: string;
        imageVersion?: string;
    }): Promise<{
        json: any;
        params: { location: string; title: string; message: string; imageId?: string; imageVersion?: string };
    }> {
        return request(`instances/${params.location}/announce`, {
            method: 'POST',
            params
        }).then((json: any) => {
            return {
                json,
                params
            };
        });
    }
};

export default instanceReq;
