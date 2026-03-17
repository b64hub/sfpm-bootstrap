import { LightningElement, wire } from 'lwc';
import { getObjectInfo, type ObjectInfoRepresentation } from 'lightning/uiObjectInfoApi';
import { refreshApex } from '@salesforce/apex';
import getArtifacts from '@salesforce/apex/SfpmArtifactController.getArtifacts';
import getArtifactHistory from '@salesforce/apex/SfpmArtifactController.getArtifactHistory';

/* ── Types ── */

interface ArtifactRecord {
    Name: string;
    Checksum__c: string;
    Commit_Id__c: string;
    Tag__c: string | null;
    Version__c: string;
}

interface HistoryRecord {
    Id: string;
    Name: string;
    Checksum__c: string;
    Commit_Id__c: string;
    Deploy_Id__c: string | null;
    Pipeline_Run_Id__c: string | null;
    Tag__c: string | null;
    Version__c: string;
    CreatedDate: string;
}

interface WireResult<T> {
    data: T | undefined;
    error: WireError | undefined;
}

interface WireError {
    message?: string;
    body?: { message?: string } | Array<{ message: string }>;
}

interface DatatableColumn {
    label: string;
    fieldName: string;
    type: string;
    cellAttributes?: Record<string, string>;
    typeAttributes?: Record<string, string>;
}

/* ── Column config ── */

const HISTORY_COLUMNS: DatatableColumn[] = [
    {
        label: 'Version',
        fieldName: 'Version__c',
        type: 'text'
    },
    {
        label: 'Commit',
        fieldName: 'Commit_Id__c',
        type: 'text',
        cellAttributes: { class: 'slds-text-font_monospace' }
    },
    {
        label: 'Checksum',
        fieldName: 'Checksum__c',
        type: 'text',
        cellAttributes: { class: 'slds-text-font_monospace' }
    },
    {
        label: 'Deploy Id',
        fieldName: 'Deploy_Id__c',
        type: 'text'
    },
    {
        label: 'Pipeline Run',
        fieldName: 'Pipeline_Run_Id__c',
        type: 'text'
    },
    {
        label: 'Date',
        fieldName: 'CreatedDate',
        type: 'date',
        typeAttributes: {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }
    }
];

export default class SfpmArtifactOverview extends LightningElement {
    artifacts: ArtifactRecord[] = [];
    historyMap: Record<string, HistoryRecord[]> = {};
    historyAvailable = false;
    historyChecked = false;
    artifactsLoaded = false;
    error: string | undefined;

    historyColumns: DatatableColumn[] = HISTORY_COLUMNS;
    wiredArtifactsResult: WireResult<ArtifactRecord[]> | undefined;

    /* ── Detect history object availability ── */
    @wire(getObjectInfo, { objectApiName: 'Sfpm_Artifact_History__c' })
    handleHistoryObjectInfo({ data, error }: WireResult<ObjectInfoRepresentation>): void {
        if (data) {
            this.historyAvailable = true;
            this.fetchHistory();
        } else if (error) {
            this.historyAvailable = false;
        }
        this.historyChecked = true;
    }

    /* ── Load artifacts (Custom Setting records) ── */
    @wire(getArtifacts)
    handleArtifacts(result: WireResult<ArtifactRecord[]>): void {
        this.wiredArtifactsResult = result;
        const { data, error: err } = result;
        if (data) {
            this.artifacts = data;
            this.error = undefined;
        } else if (err) {
            this.error = reduceErrors(err);
            this.artifacts = [];
        }
        this.artifactsLoaded = true;
    }

    /* ── Imperatively fetch history ── */
    fetchHistory(): void {
        getArtifactHistory()
            .then((result: HistoryRecord[]) => {
                const grouped: Record<string, HistoryRecord[]> = {};
                result.forEach((record) => {
                    const name = record.Name;
                    if (!grouped[name]) {
                        grouped[name] = [];
                    }
                    grouped[name].push(record);
                });
                this.historyMap = grouped;
            })
            .catch(() => {
                this.historyAvailable = false;
            });
    }

    /* ── Refresh handler ── */
    handleRefresh(): void {
        this.artifactsLoaded = false;
        refreshApex(this.wiredArtifactsResult);
        if (this.historyAvailable) {
            this.fetchHistory();
        }
        const limitsChild = this.template.querySelector('c-sfpm-org-limits') as { refresh?: () => void } | null;
        if (limitsChild?.refresh) {
            limitsChild.refresh();
        }
    }

    /* ── Computed properties ── */
    get isLoading(): boolean {
        return !this.artifactsLoaded;
    }

    get showContent(): boolean {
        return this.artifactsLoaded && !this.error;
    }

    get hasArtifacts(): boolean {
        return this.artifacts.length > 0;
    }

    get artifactCountLabel(): string {
        const count = this.artifacts.length;
        return `${count} package${count !== 1 ? 's' : ''}`;
    }

    get artifactList() {
        return this.artifacts.map((a) => ({
            ...a,
            accordionLabel: `${a.Name}  —  v${a.Version__c}`,
            commitShort: a.Commit_Id__c ? a.Commit_Id__c.substring(0, 8) : '',
            checksumShort: a.Checksum__c ? a.Checksum__c.substring(0, 12) : '',
            hasHistory: Boolean(this.historyMap[a.Name]?.length),
            historyRecords: this.historyMap[a.Name] ?? []
        }));
    }
}

/* ── Error helper ── */
function reduceErrors(error: WireError | string): string {
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    if (error.body) {
        if (typeof error.body === 'object' && !Array.isArray(error.body) && error.body.message) {
            return error.body.message;
        }
        if (Array.isArray(error.body)) {
            return error.body.map((e) => e.message).join(', ');
        }
    }
    return 'An unexpected error occurred.';
}
