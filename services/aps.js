const { SdkManagerBuilder } = require('@aps_sdk/autodesk-sdkmanager');
const { AuthenticationClient, Scopes, ResponseType } = require('@aps_sdk/authentication');
const { DataManagementClient } = require('@aps_sdk/data-management');
const { IssueClient } = require('@aps_sdk/construction-issues');
const { AdminClient } = require('@aps_sdk/construction-account-admin');

const { APS_CLIENT_ID, APS_CLIENT_SECRET, APS_CALLBACK_URL, INTERNAL_TOKEN_SCOPES, PUBLIC_TOKEN_SCOPES } = require('../config.js');

const service = module.exports = {};

const sdk = SdkManagerBuilder.create().build();
const authenticationClient = new AuthenticationClient(sdk);
const dataManagementClient = new DataManagementClient(sdk);
const issueClient = new IssueClient(sdk);
const adminClient = new AdminClient(sdk);


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


// ACC Issues APIs 

//export issues list of the project
service.getIssues = async (projectId,token) => {
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

//import issues (create new issue or modify existing issue)
service.createOrModifyIssues = async (projectId,token,data) => {
    
    let results = {
        created:[],
        modified:[],
        failed:[]
    } 

    await Promise.all(
        data.map(async (oneIssueData)=>{
        try{
            //remove unsupported fields and build the payload 
            const {id, csvRowNum, ...payload } = oneIssueData;
            if(id == '' || id==undefined || id==null){
                //create new issue
                const resp = await issueClient.createIssue(projectId,payload,{accessToken:token});
                results.created.push({id:resp.id,csvRowNum:oneIssueData.csvRowNum}); 
            }else{
                 //modify an issue
                const resp = await issueClient.patchIssueDetails(projectId,id,payload,{accessToken:token});
                results.modified.push({id:resp.id,csvRowNum:oneIssueData.csvRowNum});
            }
        }catch(e){
            results.failed.push({csvRowNum:oneIssueData.csvRowNum,reason:e.toString()}); 
        }
    })); 

    return results;
};


// ACC Admin APIs

//get project users list
service.getProjectUsers = async (projectId, token) => {
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
 
// Issue Settings

//get issue sub types setting
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

//get issue root causes setting
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

//get custom attributes definitions
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

//get issue permissions of the user
service.getIssueUserProfile= async (projectId, token) => {
    
    const resp = await issueClient.getUserProfile(projectId, {accessToken:token});
    return resp
}; 





