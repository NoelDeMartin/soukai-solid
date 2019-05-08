import { EngineAttributes } from 'soukai';

export function stubPersonJsonLD(url: string, name: string): EngineAttributes {
    return {
        '@id': url,
        '@type': [
            { '@id': 'http://www.w3.org/ns/ldp#Resource' },
            { '@id': 'http://cmlns.com/foaf/0.1/Person' },
        ],
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
