import { SolidDocumentPermission, createPrivateTypeIndex, createPublicTypeIndex } from '@noeldemartin/solid-utils';
import type { SolidUserProfile } from '@noeldemartin/solid-utils';

import type { SolidModelConstructor } from '@/models/inference';

import Model from './SolidTypeIndex.schema';

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

}
