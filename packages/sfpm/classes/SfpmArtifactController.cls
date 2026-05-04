public with sharing class SfpmArtifactController {

    @AuraEnabled(cacheable=true)
    public static List<SObject> getArtifacts() {
        return Database.query(
            'SELECT Name, Checksum__c, Commit_Id__c, Tag__c, Version__c ' +
            'FROM SfpmArtifact__c ORDER BY Name'
        );
    }

    @AuraEnabled(cacheable=true)
    public static List<SObject> getArtifactHistory() {
        try {
            return Database.query(
                'SELECT Id, Name, Checksum__c, Commit_Id__c, Deploy_Id__c, ' +
                'Pipeline_Run_Id__c, Tag__c, Version__c, CreatedDate ' +
                'FROM Sfpm_Artifact_History__c ORDER BY CreatedDate DESC LIMIT 200'
            );
        } catch (QueryException e) {
            return new List<SObject>();
        }
    }
}
