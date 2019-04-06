class Url {

    public resolve(...urls: string[]): string {
        let url = urls.shift() as string;

        while (urls.length > 0) {
            const fragment = urls.shift() as string;

            if (fragment.startsWith('/')) {
                url = this.base(url) + fragment;
            } else if (url.endsWith('/')) {
                url += fragment;
            } else {
                url += '/' + fragment;
            }
        }

        return url;
    }

    public base(url: string): string {
        const protocolIndex = url.indexOf('://');
        const pathIndex = url.substr(protocolIndex + 3).indexOf('/');

        return pathIndex !== -1
            ? url.substring(0, protocolIndex + 3 + pathIndex)
            : url;
    }

    public relativeBase(url: string): string {
        const pathIndex = url.lastIndexOf('/');

        return pathIndex !== -1 ? url.substr(0, pathIndex) : url;
    }

}

export default new Url();
