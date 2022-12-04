import { FieldType, SoukaiError } from 'soukai';
import { SolidDocumentPermission } from '@noeldemartin/solid-utils';

import { SolidEngine } from '@/engines';
import type { Fetch } from '@/engines';

import { SolidModel } from './SolidModel';
import type { ISolidModel } from './SolidModel';

const PERMISSION_MODES: Record<SolidDocumentPermission, string> = {
    [SolidDocumentPermission.Read]: 'http://www.w3.org/ns/auth/acl#Read',
    [SolidDocumentPermission.Write]: 'http://www.w3.org/ns/auth/acl#Write',
    [SolidDocumentPermission.Append]: 'http://www.w3.org/ns/auth/acl#Append',
    [SolidDocumentPermission.Control]: 'http://www.w3.org/ns/auth/acl#Control',
};

export default class SolidACLAuthorization extends SolidModel {

    public static rdfContexts = { acl: 'http://www.w3.org/ns/auth/acl#' };
    public static rdfsClasses = ['Authorization'];
    public static timestamps = false;
    public static fields = {
        agents: {
            rdfProperty: 'acl:agent',
            type: FieldType.Array,
            items: FieldType.Key,
        },
        agentClasses: {
            rdfProperty: 'acl:agentClass',
            type: FieldType.Array,
            items: FieldType.Key,
        },
        agentGroups: {
            rdfProperty: 'acl:agentGroup',
            type: FieldType.Array,
            items: FieldType.Key,
        },
        accessTo: {
            type: FieldType.Array,
            items: FieldType.Key,
        },
        accessToClasses: {
            rdfProperty: 'acl:accessToClass',
            type: FieldType.Array,
            items: FieldType.Key,
        },
        default: {
            type: FieldType.Array,
            items: FieldType.Key,
        },
        modes: {
            rdfProperty: 'acl:mode',
            type: FieldType.Array,
            items: FieldType.Key,
        },
    };

    public static get fetch(): Fetch {
        const engine = this.requireEngine();

        if (!(engine instanceof SolidEngine))
            throw new SoukaiError('ACL authorizations can only be fetched with Solid engines');

        return engine.getFetch();
    }

    public static modeFromSolidDocumentPermission(permission: SolidDocumentPermission): string {
        return PERMISSION_MODES[permission];
    }

}

export default interface SolidACLAuthorization extends ISolidModel<typeof SolidACLAuthorization> {}
