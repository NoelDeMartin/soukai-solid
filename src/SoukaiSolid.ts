import Soukai from 'soukai';

import SolidDocument from '@/models/SolidDocument';

export class SoukaiSolid {

    loadSolidModels(): void {
        Soukai.loadModels({ SolidDocument });
    }

}

export default new SoukaiSolid();
