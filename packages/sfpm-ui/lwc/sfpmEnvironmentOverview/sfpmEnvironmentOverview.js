import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getOrgContext from '@salesforce/apex/SfpmEnvironmentController.getOrgContext';
import getScratchOrgs from '@salesforce/apex/SfpmEnvironmentController.getScratchOrgs';
import getSandboxPoolOrgs from '@salesforce/apex/SfpmEnvironmentController.getSandboxPoolOrgs';
import getSandboxes from '@salesforce/apex/SfpmEnvironmentController.getSandboxes';
/* ── Column definitions ── */
const SCRATCH_ORG_COLUMNS = [
    { label: 'Name', fieldName: 'OrgName', type: 'text' },
    { label: 'Username', fieldName: 'SignupUsername', type: 'text' },
    { label: 'Status', fieldName: 'Status', type: 'text', initialWidth: 100 },
    { label: 'Edition', fieldName: 'Edition', type: 'text', initialWidth: 120 },
    { label: 'Allocation', fieldName: 'Allocation_Status__c', type: 'text', initialWidth: 110 },
    { label: 'Tag', fieldName: 'Tag__c', type: 'text', initialWidth: 100 },
    {
        label: 'Expires',
        fieldName: 'ExpirationDate',
        type: 'date',
        typeAttributes: { year: 'numeric', month: 'short', day: '2-digit' }
    },
    {
        label: 'Created',
        fieldName: 'CreatedDate',
        type: 'date',
        typeAttributes: { year: 'numeric', month: 'short', day: '2-digit' }
    }
];
const SANDBOX_COLUMNS = [
    { label: 'Name', fieldName: 'SandboxName', type: 'text' },
    { label: 'License Type', fieldName: 'LicenseType', type: 'text' },
    { label: 'Status', fieldName: 'Status', type: 'text', initialWidth: 110 },
    { label: 'Description', fieldName: 'Description', type: 'text' },
    {
        label: 'End Date',
        fieldName: 'EndDate',
        type: 'date',
        typeAttributes: { year: 'numeric', month: 'short', day: '2-digit' }
    },
    {
        label: 'Created',
        fieldName: 'CreatedDate',
        type: 'date',
        typeAttributes: { year: 'numeric', month: 'short', day: '2-digit' }
    }
];
const POOL_ORG_COLUMNS = [
    { label: 'Name', fieldName: 'Name', type: 'text' },
    { label: 'Org Id', fieldName: 'Org_Id__c', type: 'text', cellAttributes: { class: 'slds-text-font_monospace' } },
    { label: 'Allocation', fieldName: 'Allocation_Status__c', type: 'text', initialWidth: 110 },
    { label: 'Tag', fieldName: 'Tag__c', type: 'text', initialWidth: 100 },
    {
        label: 'Created',
        fieldName: 'CreatedDate',
        type: 'date',
        typeAttributes: { year: 'numeric', month: 'short', day: '2-digit' }
    }
];
export default class SfpmEnvironmentOverview extends LightningElement {
    /* ── State ── */
    context;
    contextLoaded = false;
    error;
    scratchOrgs = [];
    sandboxes = [];
    poolOrgs = [];
    scratchOrgsLoaded = false;
    sandboxesLoaded = false;
    poolOrgsLoaded = false;
    activeTab = 'limits';
    /* ── Column refs ── */
    scratchOrgColumns = SCRATCH_ORG_COLUMNS;
    sandboxColumns = SANDBOX_COLUMNS;
    poolOrgColumns = POOL_ORG_COLUMNS;
    /* ── Wire results for refresh ── */
    wiredContextResult;
    wiredScratchResult;
    wiredPoolResult;
    /* ── Org context ── */
    @wire(getOrgContext)
    handleContext(result) {
        this.wiredContextResult = result;
        const { data, error } = result;
        if (data) {
            this.context = data;
            this.error = undefined;
            if (data.isProduction) {
                this.loadProductionData();
            }
        }
        else if (error) {
            this.error = reduceErrors(error);
        }
        this.contextLoaded = true;
    }
    /* ── Production-only data fetches ── */
    loadProductionData() {
        if (this.context?.hasScratchOrgInfo) {
            this.loadScratchOrgs();
        }
        else {
            this.scratchOrgsLoaded = true;
        }
        this.loadSandboxes();
        if (this.context?.hasSandboxPoolOrg) {
            this.loadPoolOrgs();
        }
        else {
            this.poolOrgsLoaded = true;
        }
    }
    loadScratchOrgs() {
        getScratchOrgs()
            .then((result) => {
            this.scratchOrgs = result;
        })
            .catch(() => {
            this.scratchOrgs = [];
        })
            .finally(() => {
            this.scratchOrgsLoaded = true;
        });
    }
    loadSandboxes() {
        getSandboxes()
            .then((raw) => {
            const parsed = JSON.parse(raw);
            this.sandboxes = parsed.records ?? [];
        })
            .catch(() => {
            this.sandboxes = [];
        })
            .finally(() => {
            this.sandboxesLoaded = true;
        });
    }
    loadPoolOrgs() {
        getSandboxPoolOrgs()
            .then((result) => {
            this.poolOrgs = result;
        })
            .catch(() => {
            this.poolOrgs = [];
        })
            .finally(() => {
            this.poolOrgsLoaded = true;
        });
    }
    /* ── Tab handler ── */
    handleTabActive(event) {
        this.activeTab = event.target ? event.target.getAttribute('value') ?? 'limits' : 'limits';
    }
    /* ── Refresh ── */
    handleRefresh() {
        this.contextLoaded = false;
        this.scratchOrgsLoaded = false;
        this.sandboxesLoaded = false;
        this.poolOrgsLoaded = false;
        refreshApex(this.wiredContextResult);
        /* Re-fetch child data */
        if (this.context?.isProduction) {
            this.loadProductionData();
        }
        /* Refresh the org-limits child */
        const limitsChild = this.template.querySelector('c-sfpm-org-limits');
        if (limitsChild?.refresh) {
            limitsChild.refresh();
        }
    }
    /* ── Computed ── */
    get isLoading() {
        return !this.contextLoaded;
    }
    get showContent() {
        return this.contextLoaded && !this.error;
    }
    get isProduction() {
        return this.context?.isProduction ?? false;
    }
    get isSandboxOrScratch() {
        return this.context?.isSandbox ?? false;
    }
    get orgTypeBadge() {
        if (!this.context)
            return '';
        if (this.context.isProduction)
            return 'Production';
        return this.context.orgType ?? 'Sandbox';
    }
    get orgSubtitle() {
        if (!this.context)
            return '';
        return `${this.context.orgName} (${this.context.instanceName})`;
    }
    /* Tab counts */
    get scratchOrgTabLabel() {
        const count = this.scratchOrgs.length;
        return `Scratch Orgs${this.scratchOrgsLoaded ? ` (${count})` : ''}`;
    }
    get sandboxTabLabel() {
        const count = this.sandboxes.length;
        return `Sandboxes${this.sandboxesLoaded ? ` (${count})` : ''}`;
    }
    get poolOrgTabLabel() {
        const count = this.poolOrgs.length;
        return `Pool Orgs${this.poolOrgsLoaded ? ` (${count})` : ''}`;
    }
    get hasScratchOrgs() {
        return this.scratchOrgs.length > 0;
    }
    get hasSandboxes() {
        return this.sandboxes.length > 0;
    }
    get hasPoolOrgs() {
        return this.poolOrgs.length > 0;
    }
    get showScratchOrgTab() {
        return this.isProduction && (this.context?.hasScratchOrgInfo ?? false);
    }
    get showSandboxTab() {
        return this.isProduction;
    }
    get showPoolOrgTab() {
        return this.isProduction && (this.context?.hasSandboxPoolOrg ?? false);
    }
    get scratchOrgSpinner() {
        return !this.scratchOrgsLoaded;
    }
    get sandboxSpinner() {
        return !this.sandboxesLoaded;
    }
    get poolOrgSpinner() {
        return !this.poolOrgsLoaded;
    }
}
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
