type IRINamespacesMap = { [prefix: string]: string };

const KNOWN_NAMESPACES: IRINamespacesMap = {
    foaf: 'http://xmlns.com/foaf/0.1/',
    ldp: 'http://www.w3.org/ns/ldp#',
    pim: 'http://www.w3.org/ns/pim/space#',
    posix: 'http://www.w3.org/ns/posix/stat#',
    purl: 'http://purl.org/dc/terms/',
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    schema: 'https://schema.org/',
    solid: 'http://www.w3.org/ns/solid/terms#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
};

export default function IRI(value: string, namespaces: IRINamespacesMap = {}): string {
    if (/^https?:\/\//.test(value))
        return value;

    const colonIndex = value.indexOf(':');
    if (colonIndex === -1)
        return value;

    namespaces = {
        ...KNOWN_NAMESPACES,
        ...namespaces,
    };

    const namespace = value.substr(0, colonIndex);
    if (!(namespace in namespaces))
        return value;

    return namespaces[namespace] + value.substr(namespace.length + 1);
}
