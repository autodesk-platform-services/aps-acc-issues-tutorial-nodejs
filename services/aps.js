const { SdkManagerBuilder } = require('@aps_sdk/autodesk-sdkmanager');
const { AuthenticationClient, Scopes, ResponseType } = require('@aps_sdk/authentication');
const { DataManagementClient } = require('@aps_sdk/data-management');
const { IssuesClient } = require('@aps_sdk/construction-issues');
const { AdminClient } = require('@aps_sdk/construction-account-admin');

const { APS_CLIENT_ID, APS_CLIENT_SECRET, APS_CALLBACK_URL, INTERNAL_TOKEN_SCOPES } = require('../config.js');

const service = module.exports = {};

const sdk = SdkManagerBuilder.create().build();
const authenticationClient = new AuthenticationClient(sdk);
const dataManagementClient = new DataManagementClient(sdk);
const issuesClient = new IssuesClient(sdk);
const adminClient = new AdminClient(sdk);


service.getAuthorizationUrl = () => authenticationClient.authorize(APS_CLIENT_ID, ResponseType.Code, APS_CALLBACK_URL, INTERNAL_TOKEN_SCOPES);

service.authCallbackMiddleware = async (req, res, next) => {
    const internalCredentials = await authenticationClient.getThreeLeggedToken(APS_CLIENT_ID, req.query.code, APS_CALLBACK_URL, {
        clientSecret: APS_CLIENT_SECRET
    });

    req.session.internal_token = internalCredentials.access_token;
    req.session.refresh_token = internalCredentials.refresh_token;
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

        req.session.internal_token = internalCredentials.access_token;
        req.session.refresh_token = internalCredentials.refresh_token;
        req.session.expires_at = Date.now() + internalCredentials.expires_in * 1000;
    }
    req.internalOAuthToken = {
        access_token: req.session.internal_token,
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
service.getIssues = async (projectId, token) => {
    let allIssues = [];
    let offset = 0;
    let totalResults = 0;
    do {
        const resp = await issuesClient.getIssues(projectId, { accessToken: token, offset: offset });
        console.log(`Fetched ${resp.results.length} issues from offset ${offset}`);
        allIssues = allIssues.concat(resp.results);
        offset += resp.pagination.limit;
        totalResults = resp.pagination.totalResults;
    } while (offset < totalResults)
    return allIssues;
};

//import issues (create new issue or modify existing issue)
service.createOrModifyIssues = async (projectId, token, data) => {

    let results = {
        created: [],
        modified: [],
        failed: []
    }

    await Promise.all(
        data.map(async (oneIssueData) => {
            try {
                //remove unsupported fields and build the payload 
                const { id, csvRowNum, ...payload } = oneIssueData;
                if (id == '' || id == undefined || id == null) {
                    //create new issue
                    const resp = await issuesClient.createIssue(projectId, payload, { accessToken: token });
                    results.created.push({ id: resp.id, csvRowNum: oneIssueData.csvRowNum });
                    console.log(`created issue with id ${resp.id} from csv row ${oneIssueData.csvRowNum}`);
                } else {
                    //modify an issue
                    const resp = await issuesClient.patchIssueDetails(projectId, id, payload, { accessToken: token });
                    results.modified.push({ id: resp.id, csvRowNum: oneIssueData.csvRowNum });
                    console.log(`modified issue with id ${resp.id} from csv row ${oneIssueData.csvRowNum}`);
                }

            } catch (e) {
                results.failed.push({ csvRowNum: oneIssueData.csvRowNum, reason: e.toString() });
                console.log(`failed to import issue from csv row ${oneIssueData.csvRowNum} due to ${e.toString()}`);
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
    do {
        const resp = await adminClient.getProjectUsers(projectId, { accessToken: token, offset: offset });
        console.log(`Fetched ${resp.results.length} users from offset ${offset}`);
        allUsers = allUsers.concat(resp.results);
        offset += resp.pagination.limit;
        totalResults = resp.pagination.totalResults;
    } while (offset < totalResults)
    return allUsers;
};

// Issue Settings

//get issue sub types setting
service.getIssueSubtypes = async (projectId, token) => {
    let allSubtypes = [];
    let offset = 0;
    let totalResults = 0;
    do {

        const resp = await issuesClient.getIssuesTypes(projectId, { accessToken: token, include: 'subtypes', offset: offset });
        console.log(`Fetched ${resp.results.length} types from offset ${offset}`);
        let eachPage = resp.results.flatMap(item => item.subtypes);
        console.log(`Fetched ${eachPage.length} sub types`);
        allSubtypes = allSubtypes.concat(eachPage);
        offset += resp.pagination.limit;
        totalResults = resp.pagination.totalResults;
    } while (offset < totalResults)
    return allSubtypes;
};

//get issue root causes setting
service.getIssueRootcauses = async (projectId, token) => {
    let allRootcauses = [];
    let offset = 0;
    let totalResults = 0;
    do {
        const resp = await issuesClient.getRootCauseCategories(projectId, { accessToken: token, include: 'rootcauses', offset: offset });
        console.log(`Fetched ${resp.results.length} root cause categories from offset ${offset}`);
        let eachPage = resp.results.flatMap(item => item.rootCauses);
        console.log(`Fetched ${eachPage.length} root causes`);
        allRootcauses = allRootcauses.concat(eachPage);
        offset += resp.pagination.limit;
        totalResults = resp.pagination.totalResults;
    } while (offset < totalResults)
    return allRootcauses;
};

//get custom attributes definitions
service.getIssueCustomAttributesDefs = async (projectId, token) => {
    let allCustomAttributesDefs = [];
    let offset = 0;
    let totalResults = 0;
    do {
        const resp = await issuesClient.getAttributeDefinitions(projectId, { accessToken: token, offset: offset });
        console.log(`Fetched ${resp.results.length} custom attributes definitions from offset ${offset}`);
        allCustomAttributesDefs = allCustomAttributesDefs.concat(resp.results);
        offset += resp.pagination.limit;
        totalResults = resp.pagination.totalResults;
    } while (offset < totalResults)
    return allCustomAttributesDefs;
};

//get issue permissions of the user
service.getIssueUserProfile = async (projectId, token) => {
    issuesClient
    const resp = await issuesClient.getUserProfile(projectId, { accessToken: token });
    return resp
};





