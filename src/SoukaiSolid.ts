import Soukai from 'soukai';

import SolidDocument from '@/models/SolidDocument';

/**
 * @deprecated This is no longer necessary.
 */
export class SoukaiSolid {

    /**
     * @deprecated This is no longer necessary, models are loaded automatically now.
     */
    public loadSolidModels(): void {
        Soukai.loadModels({ SolidDocument });
    }

}

/**
 * @deprecated This is no longer necessary.
 */
export default new SoukaiSolid();
