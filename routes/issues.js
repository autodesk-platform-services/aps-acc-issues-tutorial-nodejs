const express = require('express');
var bodyParser = require('body-parser');

const { authRefreshMiddleware,
        getIssues,
        createOrModifyIssues,  
        getIssueSubtypes,
        getIssueRootcauses,
        getIssueCustomAttributesDefs,
        getIssueUserProfile
        } = require('../services/aps.js');

let router = express.Router();

router.use(authRefreshMiddleware); 

//get issues
router.get('/api/issues/issues', async function(req, res, next){
    try {
        const issues = await getIssues(req.query.projectId,req.internalOAuthToken.access_token);
        res.json(issues);
    } catch (err) {
        next(err);
    }
});

//create new issue or modify issue
router.post('/api/issues/issues', bodyParser.json(), async function (req, res, next) {
    const projectId = req.body.projectId;
    const issues =  req.body.data;
 
    try {
        const importResults = await createOrModifyIssues(projectId,req.internalOAuthToken.access_token,issues);
        res.json(importResults);

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


router.get('/api/issues/issueUserProfile', async function(req, res, next){
    try {
        const issueUserProfile = await getIssueUserProfile(req.query.projectId,req.internalOAuthToken.access_token);
        res.json([issueUserProfile]);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
