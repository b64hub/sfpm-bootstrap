import { LightningElement, wire } from 'lwc';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { refreshApex } from '@salesforce/apex';
import getArtifacts from '@salesforce/apex/SfpmArtifactController.getArtifacts';
import getArtifactHistory from '@salesforce/apex/SfpmArtifactController.getArtifactHistory';
/* ── Column config ── */
const HISTORY_COLUMNS = [
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
    artifacts = [];
    historyMap = {};
    historyAvailable = false;
    historyChecked = false;
    artifactsLoaded = false;
    error;
    historyColumns = HISTORY_COLUMNS;
    wiredArtifactsResult;
    /* ── Detect history object availability ── */
    @wire(getObjectInfo, { objectApiName: 'Sfpm_Artifact_History__c' })
    handleHistoryObjectInfo({ data, error }) {
        if (data) {
            this.historyAvailable = true;
            this.fetchHistory();
        }
        else if (error) {
            this.historyAvailable = false;
        }
        this.historyChecked = true;
    }
    /* ── Load artifacts (Custom Setting records) ── */
    @wire(getArtifacts)
    handleArtifacts(result) {
        this.wiredArtifactsResult = result;
        const { data, error: err } = result;
        if (data) {
            this.artifacts = data;
            this.error = undefined;
        }
        else if (err) {
            this.error = reduceErrors(err);
            this.artifacts = [];
        }
        this.artifactsLoaded = true;
    }
    /* ── Imperatively fetch history ── */
    fetchHistory() {
        getArtifactHistory()
            .then((result) => {
            const grouped = {};
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
    handleRefresh() {
        this.artifactsLoaded = false;
        refreshApex(this.wiredArtifactsResult);
        if (this.historyAvailable) {
            this.fetchHistory();
        }
        const limitsChild = this.template.querySelector('c-sfpm-org-limits');
        if (limitsChild?.refresh) {
            limitsChild.refresh();
        }
    }
    /* ── Computed properties ── */
    get isLoading() {
        return !this.artifactsLoaded;
    }
    get showContent() {
        return this.artifactsLoaded && !this.error;
    }
    get hasArtifacts() {
        return this.artifacts.length > 0;
    }
    get artifactCountLabel() {
        const count = this.artifacts.length;
        return `${count} package${count !== 1 ? 's' : ''}`;
    }
    get artifactList() {
        return this.artifacts.map((a) => {
            let parsedTags = [];
            if (a.Tag__c) {
                try {
                    const arr = JSON.parse(a.Tag__c);
                    parsedTags = arr.map((t) => ({ label: t, name: t }));
                }
                catch (_e) {
                    parsedTags = [{ label: a.Tag__c, name: a.Tag__c }];
                }
            }
            return {
                ...a,
                accordionLabel: `${a.Name}@${a.Version__c}`,
                commitShort: a.Commit_Id__c ? a.Commit_Id__c.substring(0, 8) : '',
                checksumShort: a.Checksum__c ? a.Checksum__c.substring(0, 12) : '',
                hasTags: parsedTags.length > 0,
                tags: parsedTags,
                hasHistory: Boolean(this.historyMap[a.Name]?.length),
                historyRecords: this.historyMap[a.Name] ?? []
            };
        });
    }
}
/* ── Error helper ── */
function reduceErrors(error) {
    if (typeof error === 'string')
        return error;
    if (error.message)
        return error.message;
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
