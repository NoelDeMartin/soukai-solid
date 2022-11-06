import type { Quad } from 'rdf-js';

import IRI from '@/solid/utils/IRI';
import RDFResourceProperty, { RDFResourcePropertyType } from '@/solid/RDFResourceProperty';
import type { LiteralValue } from '@/solid/RDFResourceProperty';

export default class RDFResource {

    public readonly url: string;
    public readonly types: string[];
    public readonly properties: RDFResourceProperty[];
    public readonly propertiesIndex: Record<string, RDFResourceProperty[]>;
    public readonly statements: Quad[];

    public constructor(url: string) {
        this.url = url;
        this.statements = [];
        this.types = [];
        this.properties = [];
        this.propertiesIndex = {};
    }

    public get name(): string | null {
        return this.getPropertyValue(IRI('foaf:name')) as string | null;
    }

    public get label(): string | null {
        return this.getPropertyValue(IRI('rdfs:label')) as string | null;
    }

    public isType(type: string): boolean {
        return this.types.indexOf(IRI(type)) !== -1;
    }

    public getPropertyValue(
        property: string,
        defaultValue: LiteralValue | null = null,
    ): LiteralValue | null {
        const [resourceProperty] = this.propertiesIndex[IRI(property)] || [];

        return resourceProperty ? resourceProperty.value as LiteralValue : defaultValue;
    }

    public getPropertyValues(property: string): LiteralValue[] {
        const resourceProperties = this.propertiesIndex[IRI(property)] || [];

        return resourceProperties.map(property => property.value as LiteralValue);
    }

    public addStatement(statement: Quad): void {
        if (statement.subject.value !== this.url)
            return;

        const property = RDFResourceProperty.fromStatement(statement);

        if (property.type === RDFResourcePropertyType.Type)
            this.types.push(property.value as string);

        this.statements.push(statement);
        this.properties.push(property);
        this.propertiesIndex[property.name] = [
            ...(this.propertiesIndex[property.name] || []),
            property,
        ];
    }

}
