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

    it('resolves directory adding paths', () => {
        expect(Url.resolveDirectory('http://example.com', 'foobar'))
            .toEqual('http://example.com/foobar/');
    });

    it('resolves directory for existing directory', () => {
        expect(Url.resolveDirectory('http://example.com/foobar/'))
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


    it('parses standard urls', () => {
        expect(Url.parse('https://my.subdomain.com/path/?query=search#hash')).toEqual({
            protocol: 'https',
            domain: 'my.subdomain.com',
            path: '/path/',
            query: 'query=search',
            fragment: 'hash',
        });
    });

    it('parses domains without TLD', () => {
        expect(Url.parse('ftp://localhost/nested/path')).toEqual({
            protocol: 'ftp',
            domain: 'localhost',
            path: '/nested/path',
        });
    });

    it('parses ips', () => {
        expect(Url.parse('http://192.168.1.157:8080/')).toEqual({
            protocol: 'http',
            domain: '192.168.1.157',
            port: '8080',
            path: '/',
        });
    });

    it ('cleans parts', () => {
        expect(
            Url.clean(
                'http://example.com/path/?query=search#myhash',
                {
                    path: false,
                    fragment: false,
                },
            ),
        )
            .toEqual('http://example.com?query=search');
    });

});
