const express = require('express');
var bodyParser = require('body-parser');

const { authRefreshMiddleware, 
        getProjectsACC, 
        getProjectACC, 
        getProjectUsersACC, 
        createProjectACC, 
        getUserProfile,
        getIssues,
        getIssueSubtypes,
        getIssueRootcauses,
        getIssueCustomAttributesDefs,
        createIssues,
        modifyIssues  } = require('../services/aps.js');

let router = express.Router();

router.use(authRefreshMiddleware);
 

router.get('/api/admin/projectUsers', async function (req, res, next) {
    try {
        const users = await getProjectUsersACC(req.query.projectId, req.internalOAuthToken.access_token);
        res.json(users);
    } catch (err) {
        next(err);
    }
});

router.get('/api/issues/issues', async function(req, res, next){
    try {
        const issues = await getIssues(req.query.projectId,req.internalOAuthToken.access_token);
        res.json(issues);
    } catch (err) {
        next(err);
    }
});

router.post('/api/issues/issues', bodyParser.json(), async function (req, res, next) {
    //create new issue or modify issue
    const projectId = req.body.projectId;
    const newIssues =  req.body.data.filter(i=>i.id=='' || i.id ==null || i.id==undefined)
    const oldIssues =  req.body.data.filter(i=>i.id!='' && i.id !=null && i.id!=undefined)
 
    try {
        const newIssueResults = await createIssues(projectId,req.internalOAuthToken.access_token,newIssues);
        const oldIssueResults = await modifyIssues(projectId,req.internalOAuthToken.access_token,oldIssues);

        const results = Object.assign({}, newIssueResults, oldIssueResults);
        res.json(results);

    } catch (err) {
        next(err);
    } 

});
 

router.get('/api/issues/subtypes', async function(req, res, next){
    try {
        const subTypes = await getIssueSubtypes(req.query.projectId,req.internalOAuthToken.access_token);
        res.json(subTypes);
    } catch (err) {
        next(err);
    }
});

router.get('/api/issues/rootcauses', async function(req, res, next){
    try {
        const rootcauses = await getIssueRootcauses(req.query.projectId,req.internalOAuthToken.access_token);
        res.json(rootcauses);
    } catch (err) {
        next(err);
    }
});

router.get('/api/issues/customAttDefs', async function(req, res, next){
    try {
        const customAttributes = await getIssueCustomAttributesDefs(req.query.projectId,req.internalOAuthToken.access_token);
        res.json(customAttributes);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
