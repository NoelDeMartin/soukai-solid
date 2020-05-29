import SolidContainerModel from '@/models/SolidContainerModel';
import SolidDocument from '@/models/SolidDocument';
import SolidModel from '@/models/SolidModel';

import SolidEngine from '@/engines/SolidEngine';

import Cache from '@/utils/Cache';

export async function clearCache() {
    await Cache.clear();
}

export {
    SolidContainerModel,
    SolidDocument,
    SolidEngine,
    SolidModel,
};
