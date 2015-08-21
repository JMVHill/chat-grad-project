var express = require("express");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");

module.exports = function (port, db, githubAuthoriser) {
    var app = express();
    var http = require('http').Server(app);
    var io = require('socket.io')(http);

    app.use(express.static("public"));
    app.use(cookieParser());
    app.use(bodyParser.json());

    //Collection names saved
    //var users = db.collection("users-rmcneill");
    //var conversations = db.collection("conversations-jhill01");

    //Currently active collections
    var users = db.collection("users");
    var groups = db.collection("groups-hill-01");
    var conversations = db.collection("conversations-hill-01");
    var sessions = {};

    // Constructors
    var createSaveMessage = function (params) {
        var newSaveMessage = {
            between: [],
            body: "",
            groupId: null,
            sent: null,
            seen: []
        };
        if (params) {
            if (params.from) {
                newSaveMessage.between = newSaveMessage.between.concat([params.from]);
            }
            if (params.to) {
                if (params.to instanceof Array) {
                    newSaveMessage.between = newSaveMessage.between.concat(params.to);
                    for (var index = 0; index < params.to.length; index ++) {
                        newSaveMessage.seen.concat(false);
                    }
                } else {
                    newSaveMessage.between = newSaveMessage.between.concat([params.to]);
                    newSaveMessage.seen = [false];
                }
            }
            if (params.body) {
                newSaveMessage.body = params.body;
            }
            if (params.groupId) {
                newSaveMessage.groupId = params.groupId;
            }
            if (params.sent) {
                newSaveMessage.sent = params.sent;
            }
            if (params.seen) {
                newSaveMessage.seen = params.seen;
            }
        }
        return newSaveMessage;
    };


    // HTTP calls

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
                    //console.log(user);
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

    app.get("/api/conversations/", function (req, res) {
        conversations.find({between: req.session.user}).sort({sent: 1}).toArray(function (err, docs) {
            if (!err) {
                //console.log(docs);
                res.json(docs.map(function (conversation) {
                    if (conversation.between && conversation.between.length > 0) {
                        return {
                            _id: conversation._id,
                            from: conversation.between[0],
                            to: conversation.between.slice(1),
                            sent: conversation.sent,
                            body: conversation.body,
                            seen: conversation.seen,
                            groupId: conversation.groupId
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

    app.post("/api/conversations/:to", function (req, res) {

        // Reset variables
        var from = null;
        var to = null;

        // Declare functions
        var usersFound = function () {
            if ((from) && (to)) {
                var groupId = null;
                if (req.body.groupId) {
                    groupId = req.body.groupId;
                }
                var message = {
                    between: [from._id, to._id],
                    body: req.body.body,
                    sent: req.body.sent,
                    seen: [false],
                    groupId: groupId
                };
                conversations.insert(message);
                res.sendStatus(200);
            }
        };
        var findFrom = function (err, user) {
            if (!err) {
                //console.log(user);
                from = user;
                usersFound();
            } else {
                res.sendStatus(404);
            }
        };
        var findTo = function (err, user) {
            if (!err) {
                //console.log(user);
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

    app.put("/api/conversations/user/read/:userId", function (req, res) {
        conversations.find().toArray(function (err, docs) {
            if (!err) {
                docs.forEach(function (message) {
                    if (message.between) {
                        var indexOfUser = message.between.indexOf(req.session.user) - 1;
                        if (indexOfUser > -1 && message.seen.length > indexOfUser) {
                            message.seen[indexOfUser] = true;
                            conversations.update({_id: message._id}, {$set: {seen: message.seen}}, {multi: true});
                        }
                    }
                });
            }
        });
        res.sendStatus(200);
    });


    // Socket construction
    io.on('connection', function (socket) {

        // Determine user id
        var userId = null;
        if (socket.handshake.query.userId) {
            userId = socket.handshake.query.userId;
            console.log(userId + ' connected');

            // Join rooms for groups and self
            socket.join(userId);

            // Socket events
            socket.on('disconnect', function () {
                console.log(userId + ' disconnected');
            });
            socket.on('message', function (message) {
                message.from = userId;
                console.log(message);
                io.sockets.in(message.to).emit('message', message);
                var saveMessage = createSaveMessage(message);
                console.log(saveMessage);
                conversations.insertOne(saveMessage);
            });

        }

    });

    http.listen(port, function () {
        console.log('listening on *:' + port);
    });

    // Set server to listen for http requests (keep compatability with WJ chat)
    //app.listen(port);
    //return

};
