import { LinkedDataDocument } from "@/engines/SolidEngine";

export function stubPersonJsonLD(url: string, name: string, isLDPResource: boolean = true): LinkedDataDocument {
    return {
        '@id': url,
        '@type': isLDPResource
            ? [
                { '@id': 'http://www.w3.org/ns/ldp#Resource' },
                { '@id': 'http://xmlns.com/foaf/0.1/Person' },
            ]
            : { '@id': 'http://xmlns.com/foaf/0.1/Person' },
        'http://xmlns.com/foaf/0.1/name': name,
    };
}

export function stubGroupJsonLD(url: string, name: string): LinkedDataDocument {
    return {
        '@id': url,
        '@type': [
            { '@id': 'http://www.w3.org/ns/ldp#Resource' },
            { '@id': 'http://www.w3.org/ns/ldp#Container' },
            { '@id': 'http://xmlns.com/foaf/0.1/Group' },
        ],
        'http://xmlns.com/foaf/0.1/name': name,
    };
}

export function stubMovieJsonLD(url: string, name: string): LinkedDataDocument {
    return {
        '@id': url,
        '@type': [
            { '@id': 'http://www.w3.org/ns/ldp#Resource' },
            { '@id': 'https://schema.org/Movie' },
        ],
        'https://schema.org/name': name,
    };
}

export function stubWatchActionJsonLD(url: string, movieUrl: string): LinkedDataDocument {
    return {
        '@id': url,
        '@type': { '@id': 'https://schema.org/WatchAction' },
        'https://schema.org/object': { '@id': movieUrl },
    };
}
