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

router.get('/api/admin/projects', async function(req, res, next){
    try {
        const projects = await getProjectsACC( req.query.accountId, req.oAuthToken.access_token);
        res.json(projects);
    } catch (err) {
        next(err);
    }
});

router.get('/api/admin/project', async function(req, res, next){
    let projectsList = [];
    try {
        const projectInfo = await getProjectACC( req.query.projectId, req.oAuthToken.access_token);
        projectsList.push(projectInfo);
        res.json(projectsList);
    } catch (err) {
        next(err);
    }
});

router.post('/api/admin/projects', bodyParser.json(), async function (req, res, next) {
    const accountId = req.body.accountId;
    const projects = req.body.data;
    let projectsCreated = [];
    let projectsFailed = [];
    await Promise.all(
        projects.map(async (project) => {
            try{
                let projectInfo = await createProjectACC(accountId, project, req.oAuthToken.access_token);
                projectsCreated.push(projectInfo.name);
                while( projectInfo.status != "active" ){
                    function delay(time) {
                        return new Promise(resolve => setTimeout(resolve, time));
                    }
                    await delay(1000);    
                    projectInfo = await getProjectACC( projectInfo.id, req.oAuthToken.access_token);
                }
                const profile = await getUserProfile(req.oAuthToken);
                await addProjectAdminACC( projectInfo.id, profile.email, req.oAuthToken.access_token )
            }catch(err){
                console.warn("Failed to create project for: "+ project.name + " due to: "+ err.message )
                projectsFailed.push( project.name )
            }
        })
    )
    res.json({'Succeed':projectsCreated, 'Failed': projectsFailed });
});

router.get('/api/admin/projectUsers', async function (req, res, next) {
    try {
        const users = await getProjectUsersACC(req.query.projectId, req.oAuthToken.access_token);
        res.json(users);
    } catch (err) {
        next(err);
    }
});

router.get('/api/issues/issues', async function(req, res, next){
    try {
        const issues = await getIssues(req.query.projectId,req.oAuthToken.access_token);
        res.json(issues);
    } catch (err) {
        next(err);
    }
});

router.post('/api/issues/issues', bodyParser.json(), async function (req, res, next) {
    //create new issue or modify issue
    const projectId = req.body.projectId;
    const issues = req.body.data;
    const temp =  issues.filter(i=>i.id=='' || i.id ==null || i.id==undefined)
    const newIssues = temp.map(obj => {
        const { ['id']: removed, ...rest } = obj; // Destructure and remove the key
        return rest; // Return the rest of the object without the removed key
      });
    const oldIssues =  req.body.data.filter(i=>i.id!='' && i.id !=null && i.id!=undefined)
 
    try {
        const newIssueResults = await createIssues(projectId,req.oAuthToken.access_token,newIssues);
        const oldIssueResults = await modifyIssues(projectId,req.oAuthToken.access_token,oldIssues);

        const results = Object.assign({}, newIssueResults, oldIssueResults);
        res.json(results);

    } catch (err) {
        next(err);
    }
 


});
 

router.get('/api/issues/subtypes', async function(req, res, next){
    try {
        const subTypes = await getIssueSubtypes(req.query.projectId,req.oAuthToken.access_token);
        res.json(subTypes);
    } catch (err) {
        next(err);
    }
});

router.get('/api/issues/rootcauses', async function(req, res, next){
    try {
        const rootcauses = await getIssueRootcauses(req.query.projectId,req.oAuthToken.access_token);
        res.json(rootcauses);
    } catch (err) {
        next(err);
    }
});

router.get('/api/issues/customAttDefs', async function(req, res, next){
    try {
        const customAttributes = await getIssueCustomAttributesDefs(req.query.projectId,req.oAuthToken.access_token);
        res.json(customAttributes);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
