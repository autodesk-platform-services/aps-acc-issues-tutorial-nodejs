const { SdkManagerBuilder } = require('@aps_sdk/autodesk-sdkmanager');
const { AuthenticationClient, Scopes, ResponseType } = require('@aps_sdk/authentication');
const { DataManagementClient } = require('@aps_sdk/data-management');
const { AdminClient } = require('@aps_sdk/construction-account-admin');
const { IssueClient } = require('@aps_sdk/construction-issues');

const { APS_CLIENT_ID, APS_CLIENT_SECRET, APS_CALLBACK_URL } = require('../config.js');

const service = module.exports = {};

const sdk = SdkManagerBuilder.create().build();
const authenticationClient = new AuthenticationClient(sdk);
const dataManagementClient = new DataManagementClient(sdk);
const adminClient = new AdminClient(sdk);
const issueClient = new IssueClient(sdk);


service.getAuthorizationUrl = () => authenticationClient.authorize(APS_CLIENT_ID, ResponseType.Code, APS_CALLBACK_URL, [
    Scopes.DataRead,
    Scopes.AccountRead,
    Scopes.AccountWrite
]);

service.authCallbackMiddleware = async (req, res, next) => {
    const credentials = await authenticationClient.getThreeLeggedToken(APS_CLIENT_ID, req.query.code, APS_CALLBACK_URL,{clientSecret:APS_CLIENT_SECRET});
    req.session.token = credentials.access_token;
    req.session.refresh_token = credentials.refresh_token;
    req.session.expires_at = Date.now() + credentials.expires_in * 1000;
    next();
};

service.authRefreshMiddleware = async (req, res, next) => {
    const { refresh_token, expires_at } = req.session;
    if (!refresh_token) {
        res.status(401).end();
        return;
    }

    if (expires_at < Date.now()) {
        const credentials = await authenticationClient.refreshToken(refresh_token,APS_CLIENT_ID, {
            clientSecret: APS_CLIENT_SECRET,
            scopes: [
                Scopes.DataRead,
                Scopes.AccountRead,
                Scopes.AccountWrite
            ]
        });
        req.session.token = credentials.access_token;
        req.session.refresh_token = credentials.refresh_token;
        req.session.expires_at = Date.now() + credentials.expires_in * 1000;
    }
    req.oAuthToken = {
        access_token: req.session.token,
        expires_in: Math.round((req.session.expires_at - Date.now()) / 1000)
    };
    next();
};

service.getUserProfile = async (token) => {
    const resp = await authenticationClient.getUserInfo(token.access_token);
    return resp;
};

// Data Management APIs
service.getHubs = async (token) => {
    const resp = await dataManagementClient.getHubs(token.access_token);
    return resp.data.filter((item)=>{
        return item.id.startsWith('b.');
    })
};

service.getProjects = async (hubId, token) => {
    const resp = await dataManagementClient.getHubProjects(token.access_token, hubId);
    return resp.data.filter( (item)=>{
        return item.attributes.extension.data.projectType == 'ACC';
    } )
}; 

service.getProjectUsersACC = async (projectId, token) => {
    let allUsers = [];
    let offset = 0;
    let totalResults = 0;
    do{
        const resp = await adminClient.getProjectUsers( projectId, {accessToken:token,offset:offset});
        allUsers = allUsers.concat(resp.results);
        offset += resp.pagination.limit;
        totalResults = resp.pagination.totalResults;
    }while (offset < totalResults) 
    return allUsers;    
};

service.getIssues = async (projectId, token) => {
    let allIssues = [];
    let offset = 0;
    let totalResults = 0;
    do{
    
        const resp = await issueClient.getIssues(projectId, {accessToken:token,offset:offset});
        allIssues = allIssues.concat(resp.results);
        offset += resp.pagination.limit;
        totalResults = resp.pagination.totalResults;
    }while (offset < totalResults) 
    return allIssues;
};

service.getIssueSubtypes = async (projectId, token) => {
    let allSubtypes = [];
    let offset = 0;
    let totalResults = 0;
    do{
    
        const resp = await issueClient.getIssuesTypes(projectId, {accessToken:token,include:'subtypes',offset:offset});
        let eachPage = resp.results.flatMap(item => item.subtypes);
        allSubtypes = allSubtypes.concat(eachPage);
        offset += resp.pagination.limit;
        totalResults = resp.pagination.totalResults;
    }while (offset < totalResults) 
    return allSubtypes;
};

service.getIssueRootcauses = async (projectId, token) => {
    let allRootcauses = [];
    let offset = 0;
    let totalResults = 0;
    do{
    
        const resp = await issueClient.getRootCauseCategories(projectId, {accessToken:token,include:'rootcauses',offset:offset});
        let eachPage = resp.results.flatMap(item => item.rootCauses);
        allRootcauses = allRootcauses.concat(eachPage);
        offset += resp.pagination.limit;
        totalResults = resp.pagination.totalResults;
    }while (offset < totalResults) 
    return allRootcauses;
};

service.getIssueCustomAttributesDefs = async (projectId, token) => {
    let allCustomAttributesDefs = [];
    let offset = 0;
    let totalResults = 0;
    do{
    
        const resp = await issueClient.getAttributeDefinitions(projectId, {accessToken:token,offset:offset});
        allCustomAttributesDefs = allCustomAttributesDefs.concat( resp.results);
        offset += resp.pagination.limit;
        totalResults = resp.pagination.totalResults;
    }while (offset < totalResults) 
    return allCustomAttributesDefs;
};


service.createIssues = async (projectId, token,data) => {
    
    let results = {
        created:[],
        failed:[]
    }

    await Promise.all(
        data.map(async (oneIssueData)=>{
        try{
            const resp = await issueClient.createIssue(projectId,oneIssueData,{accessToken:token});
            results.created.push({id:resp.id,csvRowNum:oneIssueData.csvRowNum});
        }catch(e){
            results.failed.push({csvRowNum:oneIssueData.csvRowNum,reason:e.toString()}); 
        }
    })); 

    return results;
};

service.modifyIssues = async (projectId, token,data) => {
    
    let results = {
        modified:[],
        failed:[]
    }
    await Promise.all(
        data.map(async (oneIssueData)=>{        
        try{
            const resp = await issueClient.patchIssueDetails(projectId,oneIssueData.id,oneIssueData,{accessToken:token});
            results.modified.push({id:resp.id,csvRowNum:oneIssueData.csvRowNum});
        }catch(e){
            results.failed.push({csvRowNum:oneIssueData.csvRowNum,reason:e.toString()}); 
        }
    })); 

    return results;
};


