export function stubPersonJsonLD(url: string, name: string, birthdate?: string): any {
    const jsonld: any = {
        '@id': url,
        '@context': {
            '@vocab': 'http://xmlns.com/foaf/0.1/',
            'ldp': 'http://www.w3.org/ns/ldp#',
        },
        '@type': 'Person',
        'name': name,
    };

    if (birthdate) {
        jsonld.birthdate = {
            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
            '@value': birthdate,
        };
    }

    return jsonLDGraph(jsonld);
}

export function stubGroupJsonLD(url: string, name: string, contains: any[] = []): any {
    const jsonld = {
        '@id': url,
        '@context': {
            '@vocab': 'http://xmlns.com/foaf/0.1/',
            'ldp': 'http://www.w3.org/ns/ldp#',
        },
        '@type': ['ldp:Container', 'Group'],
        'name': name,
    };

    if (contains.length === 1) {
        jsonld['ldp:contains'] = { '@id': contains[0] };
    } else if (contains.length > 0) {
        jsonld['ldp:contains'] = contains.map(url => ({ '@id': url }));
    }

    return jsonLDGraph(jsonld);
}

export function stubMovieJsonLD(url: string, name: string, actions: object[] = []): any {
    const jsonld: any = {
        '@id': url,
        '@context': {
            '@vocab': 'https://schema.org/',
        },
        '@type': ['Movie'],
        'name': name,
    };

    if (actions.length > 0) {
        jsonld['@context']['actions'] = { '@reverse': 'object' };
        jsonld.actions = actions;
    }

    return jsonLDGraph(jsonld);
}

export function stubWatchActionJsonLD(url: string, movieUrl: string, startTime?: string): any {
    const jsonld: any = {
        '@id': url,
        '@context': { '@vocab': 'https://schema.org/' },
        '@type': 'WatchAction',
        'object': { '@id': movieUrl },
    };

    if (startTime) {
        jsonld.startTime = {
            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
            '@value': startTime,
        };
    }

    return jsonLDGraph(jsonld);
}

export function stubSolidDocumentJsonLD(url: string, updatedAt: string): any {
    return jsonLDGraph({
        '@id': url,
        '@context': {
            '@vocab': 'http://www.w3.org/ns/iana/media-types/text/turtle#',
            'ldp': 'http://www.w3.org/ns/ldp#',
            'purl': 'http://purl.org/dc/terms/',
        },
        '@type': ['ldp:Resource', 'Resource'],
        'purl:modified': {
          '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
          '@value': updatedAt,
        },
    });
}

export function jsonLDGraph(...resources: any[]): any {
    return { '@graph': resources };
}
