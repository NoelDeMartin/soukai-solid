import type { Literal, Quad } from 'rdf-js';

import IRI from '@/solid/utils/IRI';

export type LiteralValue = string | number | boolean | Date;

export const enum RDFResourcePropertyType {
    Type,
    Reference,
    Literal,
}

class RDFResourcePropertyVariable {

    public name: string;

    constructor(value: string) {
        this.name = value;
    }

}

abstract class RDFResourceProperty {

    public readonly resourceUrl: string | null;
    public readonly name: string;
    public readonly value: unknown;
    public abstract readonly type: RDFResourcePropertyType;

    public static fromStatement(statement: Quad): RDFResourceProperty {
        const resourceUrl = statement.subject.termType === 'NamedNode'
            ? statement.subject.value
            : null;

        if (statement.predicate.value === IRI('rdf:type')) {
            return this.type(resourceUrl, statement.object.value);
        }

        if (statement.object.termType === 'NamedNode') {
            return this.reference(resourceUrl, statement.predicate.value, statement.object.value);
        }

        if (statement.object.termType === 'BlankNode') {
            return this.reference(resourceUrl, statement.predicate.value, null);
        }

        if (statement.object.termType === 'Variable') {
            return this.reference(
                resourceUrl,
                statement.predicate.value,
                new RDFResourcePropertyVariable(statement.object.value),
            );
        }

        return this.literal(
            resourceUrl,
            statement.predicate.value,
            (statement.object as Literal).datatype.value === IRI('xsd:dateTime')
                ? new Date(statement.object.value)
                : statement.object.value,
        );
    }

    public static literal(
        resourceUrl: string | null,
        name: string,
        value: LiteralValue,
    ): RDFResourceProperty {
        return new RDFResourceLiteralProperty(resourceUrl, name, value);
    }

    public static reference(
        resourceUrl: string | null,
        name: string,
        url: string | RDFResourcePropertyVariable | null,
    ): RDFResourceReferenceProperty {
        return new RDFResourceReferenceProperty(resourceUrl, name, url);
    }

    public static type(resourceUrl: string | null, type: string): RDFResourceProperty {
        return new RDFResourceTypeProperty(resourceUrl, type);
    }

    public static toTurtle(properties: RDFResourceProperty[], documentUrl: string | null = null): string {
        return properties
            .map(property => property.toTurtle(documentUrl) + ' .')
            .join('\n');
    }

    protected constructor(resourceUrl: string | null, name: string, value: unknown) {
        this.resourceUrl = resourceUrl;
        this.name = name;
        this.value = value;
    }

    public toTurtle(documentUrl: string | null = null): string {
        const subject = this.getTurtleSubject(documentUrl);
        const predicate = this.getTurtlePredicate();
        const object = this.getTurtleObject(documentUrl);

        return `${subject} ${predicate} ${object}`;
    }

    public clone(resourceUrl?: string | null): RDFResourceProperty {
        resourceUrl = resourceUrl ?? this.resourceUrl;

        switch (this.type) {
            case RDFResourcePropertyType.Literal:
                return RDFResourceProperty.literal(resourceUrl, this.name, this.value as LiteralValue);
            case RDFResourcePropertyType.Type:
                return RDFResourceProperty.type(resourceUrl, this.value as string);
            case RDFResourcePropertyType.Reference:
                return RDFResourceProperty.reference(resourceUrl, this.name, this.value as string);
        }
    }

    protected getTurtleReference(value: string | null, documentUrl: string | null): string {
        const hashIndex = value?.indexOf('#') ?? -1;

        if (!value || value === documentUrl)
            return '<>';

        if (documentUrl === null || !value.startsWith(documentUrl) || hashIndex === -1)
            return `<${encodeURI(value)}>`;

        return `<#${value.substr(hashIndex + 1)}>`;
    }

    protected getTurtleSubject(documentUrl: string | null): string {
        return this.getTurtleReference(this.resourceUrl, documentUrl);
    }

    protected getTurtlePredicate(): string {
        return `<${encodeURI(this.name)}>`;
    }

    protected abstract getTurtleObject(documentUrl: string | null): string;

}

class RDFResourceLiteralProperty extends RDFResourceProperty {

    public readonly value!: LiteralValue;
    public readonly type = RDFResourcePropertyType.Literal;

    constructor(resourceUrl: string | null, name: string, value: LiteralValue) {
        super(resourceUrl, name, value);
    }

    protected getTurtleObject(): string {
        if (this.value instanceof Date) {
            const digits = (...numbers: number[]) => numbers.map(number => number.toString().padStart(2, '0'));
            const date = digits(
                this.value.getUTCFullYear(),
                this.value.getUTCMonth() + 1,
                this.value.getUTCDate(),
            ).join('-');
            const time = digits(
                this.value.getUTCHours(),
                this.value.getUTCMinutes(),
                this.value.getUTCSeconds(),
            ).join(':');
            const milliseconds = this.value.getUTCMilliseconds().toString().padStart(3, '0');

            return `"${date}T${time}.${milliseconds}Z"^^<${IRI('xsd:dateTime')}>`;
        }

        return JSON.stringify(this.value);
    }

}

class RDFResourceReferenceProperty extends RDFResourceProperty {

    public readonly value!: string | RDFResourcePropertyVariable | null;
    public readonly type = RDFResourcePropertyType.Reference;

    constructor(
        resourceUrl: string | null,
        name: string,
        value: string | RDFResourcePropertyVariable | null,
    ) {
        super(resourceUrl, name, value);
    }

    protected getTurtleObject(documentUrl: string | null): string {
        if (this.value instanceof RDFResourcePropertyVariable)
            return this.value.name;

        return this.getTurtleReference(this.value, documentUrl);
    }

}

class RDFResourceTypeProperty extends RDFResourceProperty {

    public readonly value!: string;
    public readonly type = RDFResourcePropertyType.Type;

    constructor(resourceUrl: string | null, value: string) {
        super(resourceUrl, IRI('rdf:type'), value);
    }

    protected getTurtlePredicate(): string {
        return 'a';
    }

    protected getTurtleObject(): string {
        return `<${encodeURI(this.value)}>`;
    }

}

export default RDFResourceProperty;
