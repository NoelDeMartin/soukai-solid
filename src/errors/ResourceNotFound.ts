import { SoukaiError } from 'soukai';

export default class ResourceNotFound extends SoukaiError {

    constructor(resourceId: string, documentUrl: string) {
        super(`Couldn't find resource with id '${resourceId}' in '${documentUrl}' document.`);
    }

}
