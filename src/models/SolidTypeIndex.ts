import { asyncFirst } from '@noeldemartin/utils';
import { SolidDocumentPermission, createPrivateTypeIndex, createPublicTypeIndex } from '@noeldemartin/solid-utils';
import type { Relation } from 'soukai';
import type { SolidUserProfile } from '@noeldemartin/solid-utils';

import type { SolidModelConstructor } from '@/models/inference';

import DocumentContainsManyRelation from './relations/DocumentContainsManyRelation';
import Model from './SolidTypeIndex.schema';
import SolidContainer from './SolidContainer';
import SolidTypeRegistration from './SolidTypeRegistration';

export default class SolidTypeIndex extends Model {

    public static async createPublic<T extends SolidTypeIndex>(
        this: SolidModelConstructor<T>,
        user: SolidUserProfile,
    ): Promise<T> {
        const url = await createPublicTypeIndex(user, SolidTypeIndex.requireFetch());
        const instance = await this.findOrFail(url);

        await instance.updatePublicPermissions([SolidDocumentPermission.Read]);

        return instance;
    }

    public static async createPrivate<T extends SolidTypeIndex>(
        this: SolidModelConstructor<T>,
        user: SolidUserProfile,
    ): Promise<T> {
        const url = await createPrivateTypeIndex(user, SolidTypeIndex.requireFetch());
        const instance = await this.findOrFail(url);

        return instance;
    }

    public registrations!: SolidTypeRegistration[];
    public relatedRegistrations!: DocumentContainsManyRelation<
        this, SolidTypeRegistration, typeof SolidTypeRegistration
    >;

    public registrationsRelationship(): Relation {
        return new DocumentContainsManyRelation(this, SolidTypeRegistration);
    }

    public async findContainer<T extends SolidContainer = SolidContainer>(
        modelClass: SolidModelConstructor,
        containerClass?: SolidModelConstructor<T>,
    ): Promise<T | null> {
        const containerRegistrations = this.registrations.filter(registration => {
            return registration.instanceContainer && registration.forClass === modelClass.rdfsClasses[0];
        });

        return asyncFirst(
            containerRegistrations,
            registration => (containerClass ?? SolidContainer).find(registration?.instanceContainer) as Promise<T>,
        );
    }

}
