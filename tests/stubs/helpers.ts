import { EngineAttributes } from 'soukai';

export function stubPersonJsonLD(url: string, name: string, isLDPResource: boolean = true): EngineAttributes {
    return {
        '@id': url,
        '@type': isLDPResource
            ? [
                { '@id': 'http://www.w3.org/ns/ldp#Resource' },
                { '@id': 'http://cmlns.com/foaf/0.1/Person' },
            ]
            : { '@id': 'http://cmlns.com/foaf/0.1/Person' },
        'http://cmlns.com/foaf/0.1/name': name,
    };
}

export function stubGroupJsonLD(url: string, name: string): EngineAttributes {
    return {
        '@id': url,
        '@type': [
            { '@id': 'http://www.w3.org/ns/ldp#Resource' },
            { '@id': 'http://www.w3.org/ns/ldp#Container' },
            { '@id': 'http://cmlns.com/foaf/0.1/Group' },
        ],
        'http://cmlns.com/foaf/0.1/name': name,
    };
}

export function stubMovieJsonLD(url: string, name: string): EngineAttributes {
    return {
        '@id': url,
        '@type': [
            { '@id': 'http://www.w3.org/ns/ldp#Resource' },
            { '@id': 'https://schema.org/Movie' },
        ],
        'https://schema.org/name': name,
    };
}

export function stubWatchActionJsonLD(url: string, movieUrl: string): EngineAttributes {
    return {
        '@id': url,
        '@type': { '@id': 'https://schema.org/WatchAction' },
        'https://schema.org/object': movieUrl,
    };
}
