import { LightningElement, wire, api } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getOrgLimits from '@salesforce/apex/SfpmEnvironmentController.getOrgLimits';

/* ── Types ── */

interface LimitInfo {
    name: string;
    max: number;
    used: number;
    remaining?: number; /* backward compat with cached responses */
}

interface WireResult<T> {
    data: T | undefined;
    error: WireError | undefined;
}

interface WireError {
    message?: string;
    body?: { message?: string } | Array<{ message: string }>;
}

interface DisplayLimit {
    key: string;
    name: string;
    max: number;
    used: number;
    pct: number;
    pctLabel: string;
    variant: 'expired' | 'warning' | 'base';
}

/* ── Limit categories ── */

const ORG_LIMITS = new Set([
    'ActiveScratchOrgs',
    'DailyScratchOrgs',
    'ConcurrentAsyncGetReportInstances',
    'ConcurrentSyncReportRuns',
    'DailyApiRequests',
    'DailyAsyncApexExecutions',
    'DailyAsyncApexTests',
    'DailyBulkApiRequests',
    'DailyBulkV2QueryFileStorageMB',
    'DailyBulkV2QueryJobs',
    'DailyDurableGenericStreamingApiEvents',
    'DailyDurableStreamingApiEvents',
    'DailyGenericStreamingApiEvents',
    'DailyStreamingApiEvents',
    'DailyWorkflowEmails',
    'DataStorageMB',
    'DurableStreamingApiConcurrentClients',
    'FileStorageMB',
    'HourlyAsyncReportRuns',
    'HourlyDashboardRefreshes',
    'HourlyDashboardResults',
    'HourlyDashboardStatuses',
    'HourlyLongTermIdMapping',
    'HourlyManagedContentPublishing',
    'HourlyODataCallout',
    'HourlyPublishedPlatformEvents',
    'HourlyPublishedStandardVolumePlatformEvents',
    'HourlyShortTermIdMapping',
    'HourlySyncReportRuns',
    'HourlyTimeBasedWorkflow',
    'MassEmail',
    'MonthlyEinsteinDiscoveryStoryCreation',
    'MonthlyPlatformEventsUsageEntitlement',
    'SingleEmail',
    'StreamingApiConcurrentClients'
]);

const PACKAGE_LIMITS = new Set([
    'Package2VersionCreates',
    'Package2VersionCreatesWithoutValidation',
    'DailyApiRequests',
    'DailyAsyncApexExecutions',
    'DailyBulkApiRequests',
    'DailyBulkV2QueryJobs',
    'DataStorageMB',
    'FileStorageMB'
]);

export default class SfpmOrgLimits extends LightningElement {
    @api compact = false;
    /** Filter category: 'all' | 'org' | 'package' */
    @api category: string = 'all';

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
        /* Handle both new (used) and cached old (remaining) response shapes */
        const used = typeof l.used === 'number'
            ? l.used
            : typeof l.remaining === 'number'
                ? l.max - l.remaining
                : 0;
        const pct = l.max > 0 ? Math.round((used / l.max) * 100) : 0;
        let variant: DisplayLimit['variant'] = 'base';
        if (pct >= 90) variant = 'expired';
        else if (pct >= 70) variant = 'warning';
        return {
            name: l.name,
            max: l.max,
            used,
            key: l.name,
            pct,
            pctLabel: `${pct}%`,
            variant
        };
    }

    @api
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

    get categoryFilter(): Set<string> | null {
        if (this.category === 'org') return ORG_LIMITS;
        if (this.category === 'package') return PACKAGE_LIMITS;
        return null;
    }

    get filteredLimits(): DisplayLimit[] {
        const filter = this.categoryFilter;
        if (!filter) return this.allLimits;
        return this.allLimits.filter((l) => filter.has(l.name));
    }

    get displayLimits(): DisplayLimit[] {
        const base = this.filteredLimits;
        if (this.showAll || !this.compact) {
            return base;
        }
        /* In compact mode, show only non-zero usage or high-value limits */
        return base.filter((l) => l.pct > 0 || l.max > 0);
    }

    get hasLimits(): boolean {
        return this.displayLimits.length > 0;
    }

    get toggleLabel(): string {
        return this.showAll ? 'Show Active Limits' : `Show All (${this.filteredLimits.length})`;
    }

    get showToggle(): boolean {
        return this.compact && this.filteredLimits.length > this.displayLimits.length;
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
