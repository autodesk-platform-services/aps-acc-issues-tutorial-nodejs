const express = require('express');
var bodyParser = require('body-parser');

const { authRefreshMiddleware,
        getProjectUsers
        } = require('../services/aps.js');

let router = express.Router();

router.use(authRefreshMiddleware); 

//get project users list
router.get('/api/admin/projectUsers', async function (req, res, next) {
    try {
        const users = await getProjectUsers(req.query.projectId, req.internalOAuthToken.access_token);
        res.json(users);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
