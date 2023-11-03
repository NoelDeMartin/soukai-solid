import { findInstanceRegistrations } from '@noeldemartin/solid-utils';
import { requireUrlParentDirectory, uuid } from '@noeldemartin/utils';

import SolidTypeRegistration from '@/models/SolidTypeRegistration';
import { SolidEngine } from '@/engines/SolidEngine';
import type { SolidModel } from '@/models/SolidModel';
import type { SolidModelConstructor } from '@/models/inference';

import Model from './SolidDocument.schema';

export default class SolidDocument extends Model {

    public static async fromTypeIndex<T extends SolidDocument>(
        this: SolidModelConstructor<T>,
        typeIndexUrl: string,
        modelClass: typeof SolidModel,
    ): Promise<T[]> {
        const engine = this.requireFinalEngine();
        const fetch = engine instanceof SolidEngine ? engine.getFetch() : undefined;
        const urls = await findInstanceRegistrations(
            typeIndexUrl,
            modelClass.rdfsClasses,
            fetch,
        );

        return urls.map(url => this.newInstance({ url }, true));
    }

    public async register(typeIndexUrl: string, modelClass: typeof SolidModel): Promise<void> {
        const typeRegistration = new SolidTypeRegistration({
            forClass: modelClass.rdfsClasses[0],
            instance: this.url,
        });

        typeRegistration.mintUrl(typeIndexUrl, true, uuid());

        await typeRegistration.withEngine(
            this.requireEngine(),
            () => typeRegistration.save(requireUrlParentDirectory(typeIndexUrl)),
        );
    }

}
