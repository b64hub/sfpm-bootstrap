declare module 'lwc' {
    export class LightningElement extends HTMLElement {
        connectedCallback?(): void;
        disconnectedCallback?(): void;
        renderedCallback?(): void;
        errorCallback?(error: Error, stack: string): void;
        template: ShadowRoot;
    }
    export function wire(
        adapter: any,
        config?: Record<string, any>
    ): any;
    export function api(target: any, context: any): any;
    export function track(target: any, context: any): any;
}

declare module 'lightning/uiObjectInfoApi' {
    export interface ObjectInfoRepresentation {
        apiName: string;
        label: string;
        fields: Record<string, any>;
    }
    export function getObjectInfo(config: {
        objectApiName: string;
    }): void;
}

declare module '@salesforce/apex' {
    export function refreshApex(wiredResult: any): Promise<any>;
}

declare module '@salesforce/apex/*' {
    const apexMethod: (...args: any[]) => Promise<any>;
    export default apexMethod;
}
