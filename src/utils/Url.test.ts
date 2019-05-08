import Url from '@/utils/Url';

describe('Url helper', () => {

    it('resolves directory', () => {
        expect(Url.resolveDirectory('http://example.com', 'foobar'))
            .toEqual('http://example.com/foobar/');
    });

    it('resolves parent directory for paths', () => {
        expect(Url.parentDirectory('http://example.com/foo/bar'))
            .toEqual('http://example.com/foo/');
    });

    it('resolves parent directory for directories', () => {
        expect(Url.parentDirectory('http://example.com/foo/bar/'))
            .toEqual('http://example.com/foo/');
    });

});
