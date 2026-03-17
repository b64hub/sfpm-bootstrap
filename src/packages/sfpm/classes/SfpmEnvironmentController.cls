public with sharing class SfpmEnvironmentController {

    /* ── Org type detection ── */

    @AuraEnabled(cacheable=true)
    public static OrgContext getOrgContext() {
        List<SObject> orgs = Database.query(
            'SELECT Id, Name, OrganizationType, IsSandbox, InstanceName ' +
            'FROM Organization LIMIT 1'
        );
        SObject org = orgs[0];
        OrgContext ctx = new OrgContext();
        ctx.orgId = (String) org.get('Id');
        ctx.orgName = (String) org.get('Name');
        ctx.orgType = (String) org.get('OrganizationType');
        ctx.isSandbox = (Boolean) org.get('IsSandbox');
        ctx.instanceName = (String) org.get('InstanceName');
        ctx.isProduction = !ctx.isSandbox;
        ctx.hasScratchOrgInfo = objectExists('ScratchOrgInfo');
        ctx.hasSandboxPoolOrg = objectExists('Sandbox_Pool_Org__c');
        return ctx;
    }

    public class OrgContext {
        @AuraEnabled public String orgId;
        @AuraEnabled public String orgName;
        @AuraEnabled public String orgType;
        @AuraEnabled public Boolean isSandbox;
        @AuraEnabled public String instanceName;
        @AuraEnabled public Boolean isProduction;
        @AuraEnabled public Boolean hasScratchOrgInfo;
        @AuraEnabled public Boolean hasSandboxPoolOrg;
    }

    /* ── API Limits ── */

    @AuraEnabled(cacheable=true)
    public static List<LimitInfo> getOrgLimits() {
        Map<String, System.OrgLimit> limitsMap = OrgLimits.getMap();
        List<LimitInfo> result = new List<LimitInfo>();
        for (String key : limitsMap.keySet()) {
            System.OrgLimit lim = limitsMap.get(key);
            LimitInfo info = new LimitInfo();
            info.name = key;
            info.max = lim.getLimit();
            info.remaining = lim.getValue();
            result.add(info);
        }
        result.sort();
        return result;
    }

    public class LimitInfo implements Comparable {
        @AuraEnabled public String name;
        @AuraEnabled public Integer max;
        @AuraEnabled public Integer remaining;
        public Integer compareTo(Object other) {
            return this.name.compareTo(((LimitInfo) other).name);
        }
    }

    /* ── Scratch Org Info (standard object, only in production/dev-hub) ── */

    @AuraEnabled(cacheable=true)
    public static List<SObject> getScratchOrgs() {
        try {
            return Database.query(
                'SELECT Id, Name, OrgName, Status, Edition, ExpirationDate, ' +
                'CreatedDate, SignupUsername, ScratchOrg, ' +
                'Allocation_Status__c, Auth_Url__c, Tag__c ' +
                'FROM ScratchOrgInfo ' +
                'ORDER BY CreatedDate DESC LIMIT 100'
            );
        } catch (QueryException e) {
            return new List<SObject>();
        }
    }

    /* ── Sandbox Pool Orgs (custom object, may not exist) ── */

    @AuraEnabled(cacheable=true)
    public static List<SObject> getSandboxPoolOrgs() {
        try {
            return Database.query(
                'SELECT Id, Name, Allocation_Status__c, Auth_Url__c, Org_Id__c, Tag__c, ' +
                'CreatedDate ' +
                'FROM Sandbox_Pool_Org__c ORDER BY CreatedDate DESC LIMIT 100'
            );
        } catch (QueryException e) {
            return new List<SObject>();
        }
    }

    /* ── Helper: check object existence without getGlobalDescribe ── */

    private static Boolean objectExists(String objectName) {
        try {
            Database.query('SELECT Id FROM ' + String.escapeSingleQuotes(objectName) + ' LIMIT 0');
            return true;
        } catch (QueryException e) {
            return false;
        }
    }

    /* ── Sandbox Info via Tooling API (production only) ── */

    @AuraEnabled(cacheable=true)
    public static String getSandboxes() {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(
            Url.getOrgDomainUrl().toExternalForm() +
            '/services/data/v65.0/tooling/query/?q=' +
            EncodingUtil.urlEncode(
                'SELECT Id, SandboxName, LicenseType, Description, Status, ' +
                'EndDate, CreatedDate FROM SandboxInfo ORDER BY CreatedDate DESC LIMIT 100',
                'UTF-8'
            )
        );
        req.setMethod('GET');
        req.setHeader('Authorization', 'Bearer ' + UserInfo.getSessionId());
        req.setHeader('Content-Type', 'application/json');

        Http http = new Http();
        HttpResponse res = http.send(req);
        if (res.getStatusCode() != 200) {
            return '{"records":[]}';
        }
        return res.getBody();
    }
}
