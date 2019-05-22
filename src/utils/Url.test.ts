import Url from '@/utils/Url';

describe('Url helper', () => {

    it('uses root when resolving absolute paths', () => {
        expect(Url.resolve('http://example.com/somethingelse', '/foobar'))
            .toEqual('http://example.com/foobar');
    });

    it('uses new domains when resolving different domains', () => {
        expect(Url.resolve('http://example.com', 'http://somethingelse.com/foobar'))
            .toEqual('http://somethingelse.com/foobar');
    });

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
