import { LightningElement, wire, api } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getOrgLimits from '@salesforce/apex/SfpmEnvironmentController.getOrgLimits';

/* ── Types ── */

interface LimitInfo {
    name: string;
    max: number;
    remaining: number;
}

interface WireResult<T> {
    data: T | undefined;
    error: WireError | undefined;
}

interface WireError {
    message?: string;
    body?: { message?: string } | Array<{ message: string }>;
}

interface DisplayLimit extends LimitInfo {
    key: string;
    used: number;
    pct: number;
    pctLabel: string;
    variant: 'expired' | 'warning' | 'base';
}

/* Key limits to surface prominently */
const HIGHLIGHT_LIMITS = new Set([
    'DailyApiRequests',
    'DailyAsyncApexExecutions',
    'DailyBulkApiRequests',
    'DailyBulkV2QueryJobs',
    'DailyStreamingApiEvents',
    'HourlyAsyncReportRuns',
    'HourlyDashboardRefreshes',
    'HourlyODataCallout',
    'HourlySyncReportRuns',
    'MassEmail',
    'SingleEmail',
    'StreamingApiConcurrentClients',
    'Package2VersionCreates',
    'DataStorageMB',
    'FileStorageMB'
]);

export default class SfpmOrgLimits extends LightningElement {
    @api compact = false;

    allLimits: DisplayLimit[] = [];
    error: string | undefined;
    loaded = false;
    showAll = false;

    wiredLimitsResult: WireResult<LimitInfo[]> | undefined;

    @wire(getOrgLimits)
    handleLimits(result: WireResult<LimitInfo[]>): void {
        this.wiredLimitsResult = result;
        const { data, error } = result;
        if (data) {
            this.allLimits = data.map((l) => this.toDisplayLimit(l));
            this.error = undefined;
        } else if (error) {
            this.error = reduceErrors(error);
            this.allLimits = [];
        }
        this.loaded = true;
    }

    toDisplayLimit(l: LimitInfo): DisplayLimit {
        const used = l.max - l.remaining;
        const pct = l.max > 0 ? Math.round((used / l.max) * 100) : 0;
        let variant: DisplayLimit['variant'] = 'base';
        if (pct >= 90) variant = 'expired';
        else if (pct >= 70) variant = 'warning';
        return {
            ...l,
            key: l.name,
            used,
            pct,
            pctLabel: `${pct}%`,
            variant
        };
    }

    refresh(): void {
        this.loaded = false;
        refreshApex(this.wiredLimitsResult);
    }

    handleToggleAll(): void {
        this.showAll = !this.showAll;
    }

    /* ── Computed ── */

    get isLoading(): boolean {
        return !this.loaded;
    }

    get displayLimits(): DisplayLimit[] {
        if (this.showAll || !this.compact) {
            return this.allLimits;
        }
        return this.allLimits.filter((l) => HIGHLIGHT_LIMITS.has(l.name));
    }

    get hasLimits(): boolean {
        return this.displayLimits.length > 0;
    }

    get toggleLabel(): string {
        return this.showAll ? 'Show Key Limits' : `Show All (${this.allLimits.length})`;
    }

    get showToggle(): boolean {
        return this.compact && this.allLimits.length > 0;
    }
}

function reduceErrors(error: WireError | string): string {
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    if (error.body) {
        if (typeof error.body === 'object' && !Array.isArray(error.body) && error.body.message) {
            return error.body.message;
        }
        if (Array.isArray(error.body)) {
            return error.body.map((e: { message: string }) => e.message).join(', ');
        }
    }
    return 'An unexpected error occurred.';
}
