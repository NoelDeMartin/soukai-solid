import Soukai, {
    Attributes,
    DocumentAlreadyExists,
    EngineAttributeUpdateOperation,
    EngineAttributeValue,
    EngineDocument,
    EngineFilters,
    EngineUpdates,
    FieldDefinition,
    FieldsDefinition,
    FieldType,
    Model,
    MultiModelRelation,
    SingleModelRelation,
    SoukaiError,
} from 'soukai';

import RDF, { IRI } from '@/solid/utils/RDF';

import { useMixins } from '@/utils/mixins';
import Url from '@/utils/Url';
import UUID from '@/utils/UUID';

import SerializesToJsonLD from './mixins/SerializesToJsonLD';
import SolidBelongsToManyRelation from './relations/SolidBelongsToManyRelation';
import SolidHasManyRelation from './relations/SolidHasManyRelation';
import SolidIsContainedByRelation from './relations/SolidIsContainedByRelation';

export interface SolidFieldsDefinition extends FieldsDefinition {
    [field: string]: SolidFieldDefinition;
}

export interface SolidFieldDefinition extends FieldDefinition {
    rdfProperty: string;
}

class SolidModel extends Model {

    public static primaryKey: string = 'url';

    public static fields: SolidFieldsDefinition | any;

    public static rdfContexts: { [alias: string]: string } = {};

    public static rdfsClasses: string[] | Set<string> = [];

    public static mintsUrls: boolean = true;

    public static instance: SolidModel;

    protected static pureInstance: SolidModel;

    public static from(parentUrl: string): typeof SolidModel {
        this.collection = parentUrl;

        return this;
    }

    public static at(parentUrl: string): typeof SolidModel {
        return this.from(parentUrl);
    }

    public static boot(name: string): void {
        super.boot(name);

        this.rdfContexts = {
            ...this.rdfContexts,
            solid: 'http://www.w3.org/ns/solid/terms#',
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            ldp: 'http://www.w3.org/ns/ldp#',
            purl: 'http://purl.org/dc/terms/',
        };

        const defaultRdfContext = this.instance.getDefaultRdfContext();

        if (
            this.instance.hasAutomaticTimestamp('createdAt') &&
            typeof this.fields['createdAt'].rdfProperty === 'undefined'
        ) {
            this.fields['createdAt'].rdfProperty = IRI('purl:created');
        }

        if (
            this.instance.hasAutomaticTimestamp('updatedAt') &&
            typeof this.fields['updatedAt'].rdfProperty === 'undefined'
        ) {
            this.fields['updatedAt'].rdfProperty = IRI('purl:modified');
        }

        this.rdfsClasses = new Set(
            [...this.rdfsClasses].map(
                name =>
                    name.indexOf(':') === -1 ? (defaultRdfContext + name) : IRI(name, this.rdfContexts),
            ),
        );

        for (const field in this.fields) {
            this.fields[field].rdfProperty = IRI(
                this.fields[field].rdfProperty || `${defaultRdfContext}${field}`,
                this.rdfContexts,
            );
        }

        this.fields[this.primaryKey].rdfProperty = null;
    }

    public static find<T extends Model, Key = string>(id: Key): Promise<T | null> {
        return this.withCollection(Url.parentDirectory(id as any), () => super.find(id));
    }

    public static all<T extends Model>(filters: EngineFilters = {}): Promise<T[]> {
        filters = this.prepareEngineFilters(filters);

        return this.withCollection(() => super.all(filters));
    }

    public static prepareEngineFilters(filters: EngineFilters = {}): EngineFilters {
        return this.instance.convertEngineFiltersToJsonLD(filters);
    }

    public static async newFromJsonLD<T extends SolidModel>(jsonld: object): Promise<T> {
        const flatJsonLD = await RDF.flattenJsonLD(jsonld) as EngineDocument;
        const attributes = await this.instance.parseEngineDocumentAttributes(jsonld['@id'], flatJsonLD);
        const model = new (this as any)(attributes);

        await model.loadDocumentModels(flatJsonLD);

        return model;
    }

    protected static withCollection<Result>(collection: string | (() => Result) = '', operation?: () => Result): Result {
        const oldCollection = this.collection;

        if (typeof collection !== 'string') {
            operation = collection;
            collection = '';
        }

        if (!operation)
            throw new SoukaiError('Invalid method given to withCollection (SolidModel internals)');

        this.collection = collection || oldCollection;

        const result = operation();

        this.collection = oldCollection;

        return result;
    }

    protected classDef: typeof SolidModel;

    public save<T extends Model>(collection?: string): Promise<T> {
        return this.classDef.withCollection(collection || this.guessCollection(), async () => {
            if (!this.url && this.classDef.mintsUrls)
                this.mintUrl();

            try {
                await super.save();
            } catch (error) {
                if (!(error instanceof DocumentAlreadyExists))
                    throw error;

                this.url += '-' + UUID.generate();

                await super.save();
            }

            return this as any as T;
        });
    }

    public delete<T extends Model>(): Promise<T> {
        return this.classDef.withCollection(this.guessCollection() || '', () => super.delete());
    }

    public mintUrl(documentUrl?: string): void {
        this.setAttribute(this.classDef.primaryKey, this.newUrl(documentUrl));
    }

    public toJsonLD(): object {
        return this.serializeToJsonLD();
    }

    public getIdAttribute(): string {
        return this.getAttribute('url');
    }

    public isDirty(field?: string): boolean {
        if (field)
            return super.isDirty(field);

        if (super.isDirty())
            return true;

        // TODO this is not 100% right. Related documents are different entities,
        // even if they are stored in the same document. For now, this is a workaround
        // so that every time a model's save method is called, related models in the same
        // document are saved. This is at least consistent with the rest of the methods
        // handling dirty attributes, but it should be refactored at some point.
        // The only problem for now is that calling isDirty will yield false positives
        // in some situations.
        return !!Object
            .values(this._relations)
            .filter(relation => relation instanceof SolidHasManyRelation)
            .find((relation: SolidHasManyRelation) => relation.pendingModelsInSameDocument.length > 0);
    }

    protected isDocumentRoot(): boolean {
        return this.url && this.url.indexOf('#') === -1;
    }

    protected getDocumentUrl(): string | null {
        if (!this.url)
            return null;

        const anchorIndex = this.url.indexOf('#');

        return anchorIndex !== -1 ? this.url.substr(0, anchorIndex) : this.url;
    }

    protected getDocumentModels(): SolidModel[] {
        if (!this.isDocumentRoot())
            return [];

        const documentUrl = this.getDocumentUrl();

        return Object.values(this._relations)
            .filter(relation => relation.loaded)
            .map(relation => {
                if (relation instanceof MultiModelRelation)
                    return relation.related!;

                return [relation.related!];
            })
            .reduce((documentModels, relationModels) => [...documentModels, ...relationModels], [])
            .filter(model => model.getDocumentUrl() === documentUrl);
    }

    protected preparePendingDocumentModels(): SolidModel[] {
        const hasManyRelations = Object
            .values(this._relations)
            .filter(relation => relation instanceof SolidHasManyRelation)
            .filter(
                (relation: SolidHasManyRelation) => relation.pendingModelsInSameDocument.length > 0,
            ) as SolidHasManyRelation[];

        if (hasManyRelations.length === 0)
            return [];

        if (!this.url)
            this.mintUrl();

        const pendingDocumentModels: SolidModel[] = [];
        const documentUrl = this.getDocumentUrl()!;

        for (const relation of hasManyRelations) {
            for (const relatedModel of relation.pendingModelsInSameDocument) {
                if (!relatedModel.url)
                    relatedModel.mintUrl(documentUrl);

                relatedModel.setAttribute(relation.foreignKeyName, this.url);

                pendingDocumentModels.push(relatedModel);
            }
        }

        return pendingDocumentModels;
    }

    protected async createFromEngineDocument<T extends Model>(id: any, document: EngineDocument): Promise<T> {
        const model = await super.createFromEngineDocument<SolidModel>(id, document);

        await model.loadDocumentModels(document);

        return model as any as T;
    }

    protected async loadDocumentModels(document: EngineDocument): Promise<void> {
        const relations = Object
            .values(this._relations)
            .filter(
                relation =>
                    relation instanceof SolidHasManyRelation ||
                    relation instanceof SolidBelongsToManyRelation,
            ) as (SolidHasManyRelation | SolidBelongsToManyRelation)[];

        await Promise.all(relations.map(relation => relation.loadDocumentModels(document)));
    }

    protected async syncDirty(): Promise<string> {
        if (!this.url || this.isDocumentRoot())
            return super.syncDirty();

        // TODO this assumes that the document already exists

        const engine = Soukai.requireEngine();
        const id = this.getSerializedPrimaryKey()!;
        const documentId = this.getDocumentUrl()!;
        const updateOperation = this._exists
            ? engine.update(
                this.classDef.collection,
                documentId,
                this.getDirtyEngineDocumentUpdates(false),
            )
            : engine.update(
                this.classDef.collection,
                documentId,
                {
                    '@graph': { $push: this.serializeToJsonLD(false) as EngineDocument },
                },
            );

        await updateOperation;

        return id;
    }

    protected cleanDirty(): void {
        super.cleanDirty();

        this.getDocumentModels().map(model => model.cleanDirty());

        Object
            .values(this._relations)
            .filter(relation => relation instanceof SolidHasManyRelation)
            .forEach((relation: SolidHasManyRelation) => {
                relation.modelsInSameDocument = relation.modelsInSameDocument || [];
                relation.modelsInSameDocument.push(...relation.pendingModelsInSameDocument);
                relation.pendingModelsInSameDocument = [];
            });
    }

    protected hasMany(relatedClass: typeof SolidModel, foreignKeyField?: string, localKeyField?: string): MultiModelRelation {
        return new SolidHasManyRelation(this, relatedClass, foreignKeyField, localKeyField);
    }

    protected belongsToMany(relatedClass: typeof SolidModel, foreignKeyField?: string, localKeyField?: string): MultiModelRelation {
        return new SolidBelongsToManyRelation(this, relatedClass, foreignKeyField, localKeyField);
    }

    protected isContainedBy(model: typeof SolidModel): SingleModelRelation {
        return new SolidIsContainedByRelation(this, model);
    }

    protected getDefaultRdfContext(): string {
        return Object.values(this.classDef.rdfContexts).shift() || '';
    }

    protected toEngineDocument(): EngineDocument {
        this.preparePendingDocumentModels();

        return {
            '@graph': [
                this.serializeToJsonLD(false),
                ...this.getDocumentModels().map(model => model.serializeToJsonLD(false)),
            ],
        } as EngineDocument;
    }

    protected getDirtyEngineDocumentUpdates(includeRelations: boolean = true): EngineUpdates {
        const graphUpdates: EngineAttributeUpdateOperation[] = [];
        const pendingDocumentModels = this.preparePendingDocumentModels();

        if (includeRelations) {
            // TODO handle updates for related models in the same document

            graphUpdates.push(
                ...pendingDocumentModels.map(model => ({
                    $push: model.serializeToJsonLD(false) as EngineAttributeValue,
                })),
            );
        }

        if (super.isDirty()) {
            const modelUpdates = super.getDirtyEngineDocumentUpdates();

            graphUpdates.push({
                $updateItems: {
                    $where: { '@id': this.url },
                    $update: this.convertEngineUpdatesToJsonLD(modelUpdates),
                },
            });
        }

        return graphUpdates.length === 1
            ? { '@graph': graphUpdates[0] }
            : { '@graph': { $apply: graphUpdates } };
    }

    protected async parseEngineDocumentAttributes(id: any, document: EngineDocument): Promise<Attributes> {
        const jsonld = (document['@graph'] as EngineDocument[]).find(entity => entity['@id'] === id);

        return this.convertJsonLDToAttributes(jsonld!);
    }

    protected castAttribute(value: any, definition?: FieldDefinition): any {
        if (definition && definition.type === FieldType.Array && !Array.isArray(value)) {
            return [value];
        }

        return super.castAttribute(value, definition);
    }

    protected newUrl(documentUrl?: string): string {
        if (documentUrl)
            return documentUrl + '#' + UUID.generate();

        return Url.resolve(this.classDef.collection, UUID.generate());
    }

    protected guessCollection(): string | undefined {
        if (!this.url)
            return;

        return Url.parentDirectory(this.url);
    }

}

interface SolidModel extends SerializesToJsonLD {}

useMixins(SolidModel, [SerializesToJsonLD]);

export default SolidModel;
