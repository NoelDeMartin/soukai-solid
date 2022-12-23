import { SoukaiError } from 'soukai';
import { SolidDocumentPermission } from '@noeldemartin/solid-utils';

import { SolidEngine } from '@/engines';
import type { Fetch } from '@/engines';

import Model from './SolidACLAuthorization.schema';

const PERMISSION_MODES: Record<SolidDocumentPermission, string> = {
    [SolidDocumentPermission.Read]: 'http://www.w3.org/ns/auth/acl#Read',
    [SolidDocumentPermission.Write]: 'http://www.w3.org/ns/auth/acl#Write',
    [SolidDocumentPermission.Append]: 'http://www.w3.org/ns/auth/acl#Append',
    [SolidDocumentPermission.Control]: 'http://www.w3.org/ns/auth/acl#Control',
};

export default class SolidACLAuthorization extends Model {

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
