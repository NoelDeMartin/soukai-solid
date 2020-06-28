import Soukai from 'soukai';

import SolidDocument from '@/models/SolidDocument';

class SoukaiSolid {

    loadSolidModels(): void {
        Soukai.loadModels({ SolidDocument });
    }

}

export default new SoukaiSolid();
