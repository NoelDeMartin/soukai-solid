export abstract class SolidDocumentRelation<ProtectedThis> {

    public useSameDocument: boolean = false;

    protected get protected(): ProtectedThis {
        return this as unknown as ProtectedThis;
    }

    public usingSameDocument(useSameDocument: boolean = true): this {
        this.useSameDocument = useSameDocument;

        return this;
    }

}
