import Arr from '@/utils/Arr';

describe('Arr helper', () => {

    it('filters unique values', () => {
        expect(Arr.unique([4,1,2,1,3,4,2])).toEqual([4,1,2,3]);
    });

    it('filters unique ids', () => {
        expect(Arr.unique([4,1,2,1,3,4,2], n => n % 2)).toEqual([4,1]);
    });

});
