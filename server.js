var server = require("./server/server");
var oAuthGithub = require("./server/oauth-github");
var MongoClient = require("mongodb").MongoClient;

var port = process.env.PORT || 8080;
var dbUri = process.env.DB_URI || "mongodb://test:test@ds027491.mongolab.com:27491/chat-grad-project";
var oauthClientId = process.env.OAUTH_CLIENT_ID || "fa4a22095c46dfc1d832";
var oauthSecret = process.env.OAUTH_SECRET || "4bbf1b48173c3cbc35917fad9f94ef2b584cbaa4";

//var port = process.env.PORT || 8080;
//var dbUri = process.env.DB_URI || "mongodb://jhill:fwetqi53j@ds035633.mongolab.com:35633/chat-grad-project-jhill";
//var oauthClientId = process.env.OAUTH_CLIENT_ID || "599b656645cf92cdbe2b";
//var oauthSecret = process.env.OAUTH_SECRET || "614f15ddeecb01197f95ed627cd6b21d7b53a33e";


MongoClient.connect(dbUri, function(err, db) {
    if (err) {
        console.log("Failed to connect to db", err);
        return;
    }
    var githubAuthoriser = oAuthGithub(oauthClientId, oauthSecret);
    server(port, db, githubAuthoriser);
    console.log("Server running on port " + port);
});
