import Soukai from 'soukai';

import SolidDocument from '@/models/SolidDocument';

import SoukaiSolid from './SoukaiSolid';

describe('SoukaiSolid', () => {

    it('loads Solid models', () => {
        SoukaiSolid.loadSolidModels();

        expect(Soukai.model('SolidDocument')).toEqual(SolidDocument);
    });

});
