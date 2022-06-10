import { arrayFilter, arrayWithout, stringMatch, tap, urlParse, uuid } from '@noeldemartin/utils';
import { expandIRI } from '@noeldemartin/solid-utils';
import { requireBootedModel } from 'soukai';

import { SolidDocumentPermission } from '@/models/permissions';
import type SolidACLAuthorization from '@/models/SolidACLAuthorization';
import type { SolidModel } from '@/models/SolidModel';

export type This = SolidModel;

export default class ManagesPermissions {

    protected _publicPermissions?: SolidDocumentPermission[];

    public get isPublic(): boolean | null {
        return this._publicPermissions?.includes(SolidDocumentPermission.Read) ?? null;
    }

    public get isPrivate(): boolean | null {
        return this._publicPermissions
            ? !this._publicPermissions.includes(SolidDocumentPermission.Read)
            : null;
    }

    public async fetchPublicPermissionsIfMissing(this: This): Promise<void> {
        if (this._publicPermissions)
            return;

        await this.fetchPublicPermissions();
    }

    public async fetchPublicPermissions(this: This): Promise<void> {
        const aclAuthorizationClass = requireBootedModel<typeof SolidACLAuthorization>('SolidACLAuthorization');
        const resourceHead = await aclAuthorizationClass.fetch(this.requireDocumentUrl(), { method: 'HEAD' });
        const wacAllow = resourceHead.headers.get('WAC-Allow') ?? '';
        const publicModes = stringMatch<2>(wacAllow, /public="([^"]+)"/)?.[1] ?? '';

        this._publicPermissions = arrayFilter([
            publicModes.includes('read') && SolidDocumentPermission.Read,
            publicModes.includes('write') && SolidDocumentPermission.Write,
            publicModes.includes('append') && SolidDocumentPermission.Append,
            publicModes.includes('control') && SolidDocumentPermission.Control,
        ]);
    }

    public async updatePublicPermissions(this: This, permissions: SolidDocumentPermission[]): Promise<void> {
        await this.updateAuthorizations(permissions);

        this._publicPermissions = permissions;
    }

    private async updateAuthorizations(this: This, permissions: SolidDocumentPermission[]): Promise<void> {
        const authorizations = await this.loadRelationIfUnloaded<SolidACLAuthorization[]>('authorizations');
        const aclAuthorizationClass = requireBootedModel<typeof SolidACLAuthorization>('SolidACLAuthorization');
        const modes = permissions.map(permission => aclAuthorizationClass.modeFromSolidDocumentPermission(permission));
        const publicAuthorizations = authorizations
            .filter(authorization => authorization.agentClasses.includes(expandIRI('foaf:Agent')));
        const publicModes = publicAuthorizations.map(authorization => authorization.modes).flat();

        if (modes.length === publicModes.length && !modes.some(mode => publicModes.includes(mode)))
            return;

        if (!this.relatedAuthorizations.isDocumentACL()) {
            await this.createDocumentACLResource(modes);

            return;
        }

        if (modes.length === 0) {
            for (const authorization of publicAuthorizations) {
                await authorization.delete();
            }

            this.relatedAuthorizations.related = arrayWithout(authorizations, publicAuthorizations);

            return;
        }

        if (publicAuthorizations.length === 0) {
            await this.createPublicAuthorization(modes);

            return;
        }

        for (const authorization of publicAuthorizations) {
            await authorization.update({ modes });
        }
    }

    private async createDocumentACLResource(this: This, publicModes: string[]): Promise<void> {
        const aclAuthorizationClass = requireBootedModel<typeof SolidACLAuthorization>('SolidACLAuthorization');
        const authorizations = this.authorizations as SolidACLAuthorization[];
        const ownerAuthorizations = authorizations
            .filter(authorization => authorization.modes.includes(aclAuthorizationClass.rdfProperty('acl:Control')))
            .map(authorization => tap(
                new aclAuthorizationClass(authorization.getAttributes()),
                newAuthorization => {
                    newAuthorization.accessTo = [this.requireDocumentUrl()];
                    newAuthorization.accessToClasses = [];
                    newAuthorization.default = [];
                    newAuthorization.mintUrl(
                        this.relatedAuthorizations.requireACLUrl(),
                        false,
                        urlParse(authorization.url)?.fragment ?? uuid(),
                    );
                },
            ));

        for (const authorization of ownerAuthorizations) {
            await authorization.save();
        }

        this.relatedAuthorizations.related = ownerAuthorizations;
        this.relatedAuthorizations.effectiveACLUrl = this.relatedAuthorizations.aclUrl;

        await this.createPublicAuthorization(publicModes);
    }

    private async createPublicAuthorization(this: This, modes: string[]): Promise<void> {
        const aclAuthorizationClass = requireBootedModel<typeof SolidACLAuthorization>('SolidACLAuthorization');
        const publicAuthorization = await aclAuthorizationClass.createInDocument({
            agentClasses: [aclAuthorizationClass.rdfProperty('foaf:Agent')],
            accessTo: [this.requireDocumentUrl()],
            modes,
        }, this.relatedAuthorizations.requireACLUrl(), 'public');

        this.relatedAuthorizations.related?.push(publicAuthorization);
    }

}