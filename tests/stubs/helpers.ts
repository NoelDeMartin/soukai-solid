export function stubPersonJsonLD(url: string, name: string, birthdate?: string): any {
    const jsonld: any = {
        '@id': url,
        '@type': 'http://xmlns.com/foaf/0.1/Person',
        'http://xmlns.com/foaf/0.1/name': name,
    };

    if (birthdate) {
        jsonld['http://xmlns.com/foaf/0.1/birthdate'] = {
            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
            '@value': birthdate,
        };
    }

    return jsonLDGraph(jsonld);
}

export function stubGroupJsonLD(url: string, name: string, contains: any[] = []): any {
    const jsonld = {
        '@id': url,
        '@type': ['http://www.w3.org/ns/ldp#Container', 'http://xmlns.com/foaf/0.1/Group'],
        'http://xmlns.com/foaf/0.1/name': name,
    };

    if (contains.length === 1) {
        jsonld['http://www.w3.org/ns/ldp#contains'] = { '@id': contains[0] };
    } else if (contains.length > 0) {
        jsonld['http://www.w3.org/ns/ldp#contains'] = contains.map(url => ({ '@id': url }));
    }

    return jsonLDGraph(jsonld);
}

export function stubMovieJsonLD(url: string, name: string, actions: object[] = []): any {
    const jsonld: any = {
        '@id': url,
        '@type': ['https://schema.org/Movie'],
        'https://schema.org/name': name,
    };

    if (actions.length > 0) {
        jsonld['@context']['actions'] = { '@reverse': 'https://schema.org/object' };
        jsonld.actions = actions;
    }

    return jsonLDGraph(jsonld);
}

export function stubWatchActionJsonLD(url: string, movieUrl: string, startTime?: string): any {
    const jsonld: any = {
        '@id': url,
        '@type': 'https://schema.org/WatchAction',
        'https://schema.org/object': { '@id': movieUrl },
    };

    if (startTime) {
        jsonld['https://schema.org/startTime'] = {
            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
            '@value': startTime,
        };
    }

    return jsonLDGraph(jsonld);
}

export function stubSolidDocumentJsonLD(url: string, updatedAt: string): any {
    return jsonLDGraph({
        '@id': url,
        '@type': ['http://www.w3.org/ns/ldp#Resource', 'http://www.w3.org/ns/iana/media-types/text/turtle#Resource'],
        'http://purl.org/dc/terms/modified': {
          '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
          '@value': updatedAt,
        },
    });
}

export function jsonLDGraph(...resources: any[]): any {
    return { '@graph': resources };
}
