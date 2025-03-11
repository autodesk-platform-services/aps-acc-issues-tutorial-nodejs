const express = require('express');
const { authRefreshMiddleware, getHubs, getProjects } = require('../services/aps.js');

let router = express.Router();

router.use('/api/hubs', authRefreshMiddleware);


router.get('/api/hubs', async function (req, res, next) {
    try {
        const hubs = await getHubs(req.internalOAuthToken.access_token);
        res.json(hubs.map(hub => ({ id: hub.id, name: hub.attributes.name })));
    } catch (err) {
        next(err);
    }
});

router.get('/api/hubs/:hub_id/projects', async function (req, res, next) {
    try {
        const projects = await getProjects(req.params.hub_id, req.internalOAuthToken.access_token);
        res.json(projects.map(project => ({ id: project.id, name: project.attributes.name })));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
