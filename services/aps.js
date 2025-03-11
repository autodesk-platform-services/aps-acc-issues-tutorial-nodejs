const { SdkManagerBuilder } = require('@aps_sdk/autodesk-sdkmanager');
const { AuthenticationClient, Scopes, ResponseType } = require('@aps_sdk/authentication');
const { DataManagementClient } = require('@aps_sdk/data-management');
const { AdminClient } = require('@aps_sdk/construction-account-admin');
const { IssueClient } = require('@aps_sdk/construction-issues');

const { APS_CLIENT_ID, APS_CLIENT_SECRET, APS_CALLBACK_URL, INTERNAL_TOKEN_SCOPES, PUBLIC_TOKEN_SCOPES } = require('../config.js');

const service = module.exports = {};

const sdk = SdkManagerBuilder.create().build();
const authenticationClient = new AuthenticationClient(sdk);
const dataManagementClient = new DataManagementClient(sdk);
const adminClient = new AdminClient(sdk);
const issueClient = new IssueClient(sdk);


service.getAuthorizationUrl = () => authenticationClient.authorize(APS_CLIENT_ID, ResponseType.Code, APS_CALLBACK_URL, INTERNAL_TOKEN_SCOPES);

service.authCallbackMiddleware = async (req, res, next) => {
    const internalCredentials = await authenticationClient.getThreeLeggedToken(APS_CLIENT_ID, req.query.code, APS_CALLBACK_URL, {
        clientSecret: APS_CLIENT_SECRET
    });
    const publicCredentials = await authenticationClient.refreshToken(internalCredentials.refresh_token, APS_CLIENT_ID, {
        clientSecret: APS_CLIENT_SECRET,
        scopes: PUBLIC_TOKEN_SCOPES
    });
    req.session.public_token = publicCredentials.access_token;
    req.session.internal_token = internalCredentials.access_token;
    req.session.refresh_token = publicCredentials.refresh_token;
    req.session.expires_at = Date.now() + internalCredentials.expires_in * 1000;
    next();
};

service.authRefreshMiddleware = async (req, res, next) => {
    const { refresh_token, expires_at } = req.session;
    if (!refresh_token) {
        res.status(401).end();
        return;
    }

    if (expires_at < Date.now()) {
        const internalCredentials = await authenticationClient.refreshToken(refresh_token, APS_CLIENT_ID, {
            clientSecret: APS_CLIENT_SECRET,
            scopes: INTERNAL_TOKEN_SCOPES
        });
        const publicCredentials = await authenticationClient.refreshToken(internalCredentials.refresh_token, APS_CLIENT_ID, {
            clientSecret: APS_CLIENT_SECRET,
            scopes: PUBLIC_TOKEN_SCOPES
        });
        req.session.public_token = publicCredentials.access_token;
        req.session.internal_token = internalCredentials.access_token;
        req.session.refresh_token = publicCredentials.refresh_token;
        req.session.expires_at = Date.now() + internalCredentials.expires_in * 1000;
    }
    req.internalOAuthToken = {
        access_token: req.session.internal_token,
        expires_in: Math.round((req.session.expires_at - Date.now()) / 1000),
    };
    req.publicOAuthToken = {
        access_token: req.session.public_token,
        expires_in: Math.round((req.session.expires_at - Date.now()) / 1000),
    };
    next();
};

service.getUserProfile = async (accessToken) => {
    const resp = await authenticationClient.getUserInfo(accessToken);
    return resp;
};

// Data Management APIs
service.getHubs = async (accessToken) => {
    const resp = await dataManagementClient.getHubs({ accessToken });
    return resp.data;
};

service.getProjects = async (hubId, accessToken) => {
    const resp = await dataManagementClient.getHubProjects(hubId, { accessToken });
    return resp.data;
};


// ACC Admin APIs
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

// ACC Assue APIs

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
    //remove id field from the payload.
    var data = data.map(obj => {
        const { ['id']: removed, ...rest } = obj;
        return rest;
    });
    await Promise.all(
        data.map(async (oneIssueData)=>{
        try{
            //remove unsupported fields and build the payload
            const {id, csvRowNum, ...payload } = oneIssueData;
            const resp = await issueClient.createIssue(projectId,payload,{accessToken:token});
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
            const issueId=  oneIssueData.id;
            //remove unsupported fields and build the payload
            const {id, csvRowNum, ...payload } = oneIssueData;
            const resp = await issueClient.patchIssueDetails(projectId,issueId,payload,{accessToken:token});
            results.modified.push({id:resp.id,csvRowNum:oneIssueData.csvRowNum});
        }catch(e){
            results.failed.push({csvRowNum:oneIssueData.csvRowNum,reason:e.toString()}); 
        }
    })); 

    return results;
};


