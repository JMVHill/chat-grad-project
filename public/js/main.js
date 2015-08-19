(function () {
    var app = angular.module("ChatApp", []); //"pubnub.angular.service"

    app.controller("ChatController", function ($scope, $http) { // PubNub

        // Declare variables
        $scope.user = null;
        $scope.userId = null;
        $scope.chatTarget = null;
        $scope.loggedIn = false;
        $scope.newMessage = {from: null, to: null, time: null, body: ""};
        $scope.conversations = [];
        $scope.currentConversation = null;
        $scope.conversationString = "";

        // Get information for all users in DB
        $scope.performLogin = function () {
            $http.get("/api/user").then(function (userResult) {
                $scope.loggedIn = true;
                $scope.user = userResult.data;
                $scope.userId = $scope.user._id;
                $http.get("/api/users").then(function (result) {
                    $scope.users = result.data;
                    $scope.getMessage();
                });
            }, function () {
                $http.get("/api/oauth/uri").then(function (result) {
                    $scope.loginUri = result.data.uri;
                });
            });
        };

        // Set the current chat target
        $scope.setChatTarget = function (chatTarget) {
            $scope.chatTarget = chatTarget;
            $scope.updateChatBox(chatTarget);
        };

        // Submit message to target
        $scope.sendMessage = function () {
            if ($scope.newMessage !== "") {
                var newDate = new Date();
                $scope.newMessage.time = newDate.getTime();
                $http.post("/api/conversations/" + $scope.chatTarget.id, $scope.newMessage).then(function (response) {
                    $scope.getMessage();
                    $scope.newMessage = '';
                }, function (error) {
                    console.log(error);
                });
            }
        };

        // Get messages targeting the user
        $scope.getMessage = function () {
            if ($scope.user) {
                $http.get("/api/conversations/" + $scope.user._id).then(function (response) {

                    // Define variables
                    var messages = response.data;
                    var messageBuilder = [];
                    var chatExists = false;
                    var thisMessage = null;
                    var otherParticipant = null;

                    // Construct messageBuilder object
                    for (var messageIndex = 0; messageIndex < messages.length; messageIndex++) {
                        thisMessage = messages[messageIndex];

                        // Get group identifier or otherParticipant
                        thisMessage.unread = !thisMessage.unread;
                        otherParticipant = thisMessage.from;
                        var groupId = thisMessage.groupId;
                        if (thisMessage.from === $scope.user._id) {
                            if (!thisMessage.groupId) {
                                otherParticipant = thisMessage.to[0];
                            }
                        }

                        // Search for existing conversation
                        chatExists = false;
                        for (var chatIndex = 0; chatIndex < messageBuilder.length; chatIndex++) {
                            if ((groupId && groupId == messageBuilder[chatIndex].groupId) ||
                                (groupId == null && messageBuilder[chatIndex].participant == otherParticipant)) {
                                messageBuilder[chatIndex].messages.push(thisMessage);
                                chatExists = true;
                            }
                        }

                        // Add new chat
                        if (!chatExists) {
                            messageBuilder.push({
                                participant: otherParticipant,
                                unread: 0,
                                messages: [thisMessage]
                            });
                        }
                    }

                    // Perform filter counts for all conversations
                    for (var chatIndex = 0; chatIndex < messageBuilder.length; chatIndex++) {
                        messageBuilder[chatIndex].unread =
                            messageBuilder[chatIndex].messages.filter(function (message) {
                                return (message.unread && message.from !== $scope.user._id);
                            }).length;
                    }

                    // Save change in messages
                    var chatArea = document.getElementById("chat-text-area");
                    $scope.conversations = messageBuilder;
                    chatArea.scrollTop = chatArea.scrollHeight + 10;

                    // Update GUI
                    $scope.updateChatBox($scope.chatTarget);

                }, function (error) {
                    console.log(error);
                });
            }
        };

        // Update conversation box -- must modify to take into account groups
        $scope.updateChatBox = function (chatPartner) {
            if ((chatPartner) && ($scope.conversations)) {
                var conversation = null;
                for (var index = 0; index < $scope.conversations.length; index++) {
                    if ($scope.conversations[index].participant == chatPartner.id) {
                        conversation = $scope.conversations[index];
                        break;
                    }
                }
                var origConversation = $scope.currentConversation;
                $scope.currentConversation = conversation;
                if (!origConversation || ($scope.currentConversation && origConversation.id !== $scope.currentConversation.id)) {
                    //$scope.markMessageSent(chatPartner);
                }
            }
        };

        // Determine if the user has unread messages
        $scope.userHasUnread = function (user) {
            for (var index = 0; index < $scope.conversations.length; index++) {
                if (!$scope.conversations[index].groupId && $scope.conversations[index].participant == user.id) {
                    return ($scope.conversations[index].unread > 0);
                }
            }
            return false;
        };

        // Determine home many unread messages the user has
        $scope.userUnreadCount = function (user) {
            for (var index = 0; index < $scope.conversations.length; index++) {
                if (!$scope.conversations[index].groupId && $scope.conversations[index].participant == user.id) {
                    return $scope.conversations[index].unread;
                }
            }
            return 0;
        };

        //var unreadIndex = $scope.conversations[index].unread.indexOf(user.id);
        //if (unreadIndex !== -1) {
        //
        //}

        // Mark user messages as seen
        $scope.markMessageSent = function (user) {
            for (var index = 0; index < $scope.conversations.length; index++) {
                if ($scope.conversations[index].participant == user.id) {
                    for (var messageIndex = 0; messageIndex < $scope.conversations[index].messages.length; messageIndex++) {
                        if (!$scope.conversations[index].messages[messageIndex].seen) {
                            $http.put("/api/conversations/read/" +
                                $scope.conversations[index].messages[messageIndex]._id, {}).then(function (response) {

                            }, function (error) {
                                console.log(error);
                            })
                        }
                    }
                }
            }
        };

        // Call login
        $scope.performLogin();

        // Poll server for updates
        setInterval($scope.getMessage, 1000);

    });
})();
