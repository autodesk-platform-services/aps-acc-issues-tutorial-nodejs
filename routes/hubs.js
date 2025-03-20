const express = require('express');
const { authRefreshMiddleware, getHubs, getProjects } = require('../services/aps.js');

let router = express.Router();

router.use('/api/hubs', authRefreshMiddleware);


router.get('/api/hubs', async function (req, res, next) {
    try {
        const hubs = await getHubs(req.internalOAuthToken.access_token);
        //build the json response with some data of the hub
        res.json(hubs.map(hub => ({type:hub.type, id: hub.id, name: hub.attributes.name,region:hub.attributes.region})));
    } catch (err) {
        next(err);
    }
});

router.get('/api/hubs/:hub_id/projects', async function (req, res, next) {
    try {
        const projects = await getProjects(req.params.hub_id, req.internalOAuthToken.access_token);
        //build the json response with some data of the project 
        res.json(projects.map(project => ({type:project.type, id: project.id, name: project.attributes.name, })));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
