var express = require("express");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");

module.exports = function (port, db, githubAuthoriser) {
    var app = express();

    app.use(express.static("public"));
    app.use(cookieParser());
    app.use(bodyParser.json());

    var users = db.collection("users");//-jhill");
    //var users = db.collection("users-rmcneill");
    //var conversations = db.collection("conversations-jhill01");
    var conversations = db.collection("conversations-wpferg");
    var sessions = {};

    app.get("/oauth", function (req, res) {
        githubAuthoriser.authorise(req, function (githubUser, token) {
            if (githubUser) {
                users.findOne({
                    _id: githubUser.login
                }, function (err, user) {
                    if (!user) {
                        // TODO: Wait for this operation to complete
                        users.insertOne({
                            _id: githubUser.login,
                            name: githubUser.name,
                            avatarUrl: githubUser.avatar_url
                        });
                    }
                    sessions[token] = {
                        user: githubUser.login
                    };
                    res.cookie("sessionToken", token);
                    res.header("Location", "/");
                    res.sendStatus(302);
                });
            }
            else {
                res.sendStatus(400);
            }

        });
    });

    app.get("/api/oauth/uri", function (req, res) {
        res.json({
            uri: githubAuthoriser.oAuthUri
        });
    });

    app.use(function (req, res, next) {
        if (req.cookies.sessionToken) {
            req.session = sessions[req.cookies.sessionToken];
            if (req.session) {
                next();
            } else {
                res.sendStatus(401);
            }
        } else {
            res.sendStatus(401);
        }
    });

    app.get("/api/user", function (req, res) {
        users.findOne({
            _id: req.session.user
        }, function (err, user) {
            if (!err) {
                res.json(user);
            } else {
                res.sendStatus(500);
            }
        });
    });

    app.get("/api/users", function (req, res) {
        users.find().toArray(function (err, docs) {
            if (!err) {
                res.json(docs.map(function (user) {
                    return {
                        id: user._id,
                        name: user.name,
                        avatarUrl: user.avatarUrl
                    };
                }));
            } else {
                res.sendStatus(500);
            }
        });
    });

    app.post("/api/conversations/:to", function (req, res) {

        // Reset variables
        var from = null;
        var to = null;

        // Declare functions
        var usersFound = function () {
            if ((from) && (to)) {
                var message = {
                    between: [from._id, to._id],
                    body: req.body.body,
                    sent: req.body.time,
                    seen: [false]
                };
                console.log(message);
                conversations.insert(message);
                console.log(message);
                res.sendStatus(200);
            }
        };
        var findFrom = function (err, user) {
            if (!err) {
                console.log(user);
                from = user;
                usersFound();
            } else {
                res.sendStatus(404);
            }
        };
        var findTo = function (err, user) {
            if (!err) {
                console.log(user);
                to = user;
                usersFound();
            } else {
                res.sendStatus(404);
            }
        };

        // Find two users before continuing
        users.findOne({_id: req.session.user}, findFrom);
        users.findOne({_id: req.params.to}, findTo);

    });

    app.get("/api/conversations/:to", function (req, res) {
        conversations.find({between: req.params.to}).toArray(function (err, docs) {
            if (!err) {
                res.json(docs.map(function (conversation) {
                    //console.log(conversation);
                    if (conversation.between) {
                        return {
                            _id: conversation._id,
                            from: conversation.between[0],
                            to: conversation.between[1],
                            time: conversation.sent,
                            body: conversation.body,
                            seen: conversation.seen
                        }
                    } else {
                        return {};
                    }
                }));
            } else {
                res.sendStatus(500);
            }
        });
    });

    app.put("/api/conversations/read/:id", function (req, res) {
        conversations.findOne({
            _id: id
        }, function (err, conversation) {
            if (!err) {
                conversation.seen = true;
                res.json(conversation);
            } else {
                res.sendStatus(500);
            }
        });
    });

    return app.listen(port);
};
