import Soukai from 'soukai';

import Url from '@/utils/Url';

import SolidModel from '@/models/SolidModel';

type ResourcesGraph = { '@graph': { '@id': string }[] };
type DocumentModels = { documentUrl: string, models: SolidModel[] };
type DecantedDocumentModels = Record<string, SolidModel[]>;
type DecantedContainerDocuments = Record<string, DocumentModels[]>;

export default class DeletesModels {

    protected async deleteModels(models: SolidModel[]): Promise<void> {
        const containersDocuments = this.decantDocumentModelsByContainer(models);

        await Promise.all(
            Object
                .entries(containersDocuments)
                .map(
                    ([containerUrl, containerDocuments]) => this.deleteContainerDocumentsModels(
                        containerUrl,
                        containerDocuments,
                    ),
                ),
        );
    }

    private decantDocumentModelsByContainer(models: SolidModel[]): DecantedContainerDocuments {
        const documentModels = this.decantModelsByDocument(models);

        return Object.entries(documentModels).reduce((containerModels, [documentUrl, models]) => {
            const containerUrl = Url.parentDirectory(documentUrl);

            if (!(containerUrl in containerModels))
                containerModels[containerUrl] = [];

            containerModels[containerUrl].push({ documentUrl, models });

            return containerModels;
        }, {} as DecantedContainerDocuments);
    }

    private decantModelsByDocument(models: SolidModel[]): DecantedDocumentModels {
        return models.reduce((documentModels, model) => {
            const documentUrl = model.getDocumentUrl()!;

            if (!(documentUrl in documentModels))
                documentModels[documentUrl] = [];

            documentModels[documentUrl].push(model);

            return documentModels;
        }, {} as DecantedDocumentModels);
    }

    private async deleteContainerDocumentsModels(containerUrl: string, documentsModels: DocumentModels[]): Promise<void> {
        const engine = Soukai.requireEngine();
        const engineDocuments = await engine.readMany(
            containerUrl,
            { $in: documentsModels.map(({ documentUrl }) => documentUrl) },
        ) as Record<string, ResourcesGraph>;

        await Promise.all(
            documentsModels.map(
                ({ documentUrl, models }) => this.deleteDocumentModels(
                    engineDocuments,
                    containerUrl,
                    documentUrl,
                    models,
                ),
            )
        );
    }

    private async deleteDocumentModels(
        engineDocuments: Record<string, ResourcesGraph>,
        containerUrl: string,
        documentUrl: string,
        models: SolidModel[],
    ): Promise<void> {
        const engine = Soukai.requireEngine();
        const modelUrls = models.map(model => model.url);
        const { '@graph': resources } = engineDocuments[documentUrl];

        if (!resources.some(resource => !modelUrls.some(url => url === resource['@id']))) {
            await engine.delete(containerUrl, documentUrl);

            return;
        }

        await engine.update(containerUrl, documentUrl, {
            '@graph': {
                $updateItems: {
                    $where: { '@id': { $in: modelUrls } },
                    $unset: true,
                },
            },
        });
    }

}
