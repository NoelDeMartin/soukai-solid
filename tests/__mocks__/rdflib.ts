import StubHeaders from '@tests/stubs/StubHeaders';

const $rdf = require('rdflib');
const RDFMock = jest.genMockFromModule<any>('rdflib');

const spies = ['Namespace', 'graph', 'parse', 'sym'];
for (const spy of spies) {
    RDFMock[spy] = jest.spyOn($rdf, spy);
}

const original = ['NamedNode'];
for (const originalMember of original) {
    RDFMock[originalMember] = $rdf[originalMember];
}

RDFMock.__webOperationResults = [];

RDFMock.Fetcher = jest.fn(function (this: any) {
    this.webOperation = jest.fn(() => RDFMock.__webOperationResults.shift());
});

RDFMock.__addWebOperationResult = function (headers: {} = {}) {
    RDFMock.__webOperationResults.push({
        headers: StubHeaders.make(headers),
    });
};

export const NamedNode = $rdf.NamedNode;
export const IndexedFormula = $rdf.IndexedFormula;

export default RDFMock;
