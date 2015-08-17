(function () {
    var app = angular.module("ChatApp", []); //"pubnub.angular.service"

    app.controller("ChatController", function ($scope, $http) { // PubNub

        // Declare variables
        $scope.user = null;
        $scope.chatTarget = null;
        $scope.loggedIn = false;
        $scope.newMessage = {from: null, to: null, time: null, body: ""};
        $scope.conversations = [];
        $scope.currentConversation = null;
        $scope.conversationString = "";

        // Get information for all users in DB
        $http.get("/api/user").then(function (userResult) {
            $scope.loggedIn = true;
            $scope.user = userResult.data;
            $http.get("/api/users").then(function (result) {
                $scope.users = result.data;
                $scope.getMessage();
            });
        }, function () {
            $http.get("/api/oauth/uri").then(function (result) {
                $scope.loginUri = result.data.uri;
            });
        });

        // Set the current chat target
        $scope.setChatTarget = function (chatTarget) {
            $scope.chatTarget = chatTarget;
            $scope.updateChatBox(chatTarget);
        };

        // Submit message to target
        $scope.sendMessage = function () {
            var newDate = new Date();
            $scope.newMessage.time = newDate.getTime();
            $http.post("/api/conversations/" + $scope.chatTarget.id, $scope.newMessage).then(function (response) {
                console.log(response);
            }, function (error) {
                console.log(error);
            });
        };

        // Get messages targeting the user
        $scope.getMessage = function () {
            if ($scope.user) {
                $http.get("/api/conversations/" + $scope.user._id).then(function (response) {
                    var messages = response.data;
                    var messageBuilder = [];
                    var chatExists = false;
                    var chatIndex = 0;
                    var otherPartner = null;
                    for (var messageIndex = 0; messageIndex < messages.length; messageIndex++) {
                        thisMessage = messages[messageIndex];
                        otherPartner = thisMessage.from;
                        if (otherPartner === $scope.user._id) {
                            otherPartner = thisMessage.to;
                        }
                        for (chatIndex = 0; chatIndex < messageBuilder.length; chatIndex++) {
                            if (messageBuilder[chatIndex].partner == otherPartner) {
                                messageBuilder[chatIndex].messages.push(thisMessage);
                            }
                        }
                        if (!chatExists) {
                            messageBuilder.push({partner: otherPartner, messages: [thisMessage]});
                        }
                    }
                    $scope.conversations = messageBuilder;
                    $scope.updateChatBox($scope.chatTarget);
                }, function (error) {
                    console.log(error);
                });
            }
        };

        // Update conversation box
        $scope.updateChatBox = function (chatPartner) {
            if ((chatPartner) && ($scope.conversations)) {
                var conversation = null;
                for (var index = 0; index < $scope.conversations.length; index ++) {
                    if ($scope.conversations[index].partner == chatPartner.id) {
                        conversation = $scope.conversations[index];
                        break;
                    }
                }
                $scope.currentConversation = conversation;
            }
        };

        // Poll server for updates
        //setInterval($scope.getMessage, 5000);

    });
})();
