(function () {
    var app = angular.module("ChatApp", []); //"pubnub.angular.service"

    app.controller("ChatController", function ($scope, $http) { // PubNub

        // Declare variables
        $scope.user = null;
        $scope.userId = null;
        $scope.chatTarget = null;
        $scope.loggedIn = false;
        $scope.newMessage = {from: null, to: null, sent: null, body: ""};
        $scope.conversations = [];
        $scope.currentConversation = null;
        $scope.conversationString = "";
        $scope.newChatUserSearch = "";
        $scope.newChat = {active: false, hoverUser: null};


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

        // Mouse over item hover event for selecting user for group
        $scope.newChatUserMouseOver = function (user, index) {
            if (user) {
                $scope.newChat.hover.user = user;
                $scope.newChat.hover.index = index;
            }
        };

        // Create new group button click
        $scope.newChatButtonClick = function () {
            $scope.newChat = {
                title: "",
                users: [],
                body: "",
                active: true,
                hover: {index: -1, object: null}
            };
            $scope.chatTarget = null;
        };

        // Compare hover users as it doesnt properly work in angular (who knows why?)
        $scope.compareHoverUser = function (user) {
            //console.log(user);
            //console.log($scope.newChat.hoverUser);
            return (user.id == $scope.newChat.hover.user.id);
        };

        // Method to perform navigation in user selection
        $scope.navigateNewChatUserSelect = function (event) {
            //console.log(event);
        };

        // Select a user from filtered users list for new chat
        $scope.selectHoverUser = function () {
            if ($scope.newChat.users.indexOf($scope.newChat.hover.user) == -1) {
                $scope.newChat.users.push($scope.newChat.hover.user);
                $scope.newChat.hover.user = null;
                $scope.newChat.hover.index = -1;
                $scope.newChatUserSearch = "";
            }
        };

        // Perform filtering for user selection in newChat UI
        $scope.filterUserListForNewChat = function(user) {
            var result = false;
            console.log(user);
            if (user) {
                var searchString = user.name;
                if (!searchString) { searchString = user.id; }
                if (searchString) {
                    result = (searchString.toLowerCase().indexOf($scope.newChatUserSearch.toLowerCase()) !== -1);
                }
                if (result) {
                    for (var index = 0; index < $scope.newChat.users.length; index ++) {
                        if ($scope.newChat.users[index] == user) {
                            result = false;
                            break;
                        }
                    }
                }
            }
            return result;
        };

        // Focus on the filter edit for creating a new chat
        $scope.focusNewChatFilterSearch = function() {
            document.getElementById("new-chat-filter-edit").focus();
        };

        // Delete a selected hover user from new users
        $scope.deleteHoverUser = function(user) {
            var foundIndex = $scope.newChat.users.indexOf(user);
            if (foundIndex !== -1) {
                $scope.newChat.users.splice(foundIndex, 1);
            }
        };

        // Set the current chat target
        $scope.setChatTarget = function (chatTarget) {
            $scope.newChat = {active: false};
            $scope.chatTarget = chatTarget;
            $scope.updateChatBox(chatTarget);
        };

        // Submit message to target
        $scope.sendMessage = function () {
            if ($scope.newMessage !== "") {
                var newDate = new Date();
                $scope.newMessage.sent = newDate.getTime();
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
                $http.get("/api/conversations/").then(function (response) {

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
                                var userIndex = message.to.indexOf($scope.user._id);
                                if (userIndex > -1 && message.seen.length > userIndex) {
                                    return !message.seen[userIndex];
                                }
                                return false;
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
                for (var index = 0; index < $scope.conversations.length; index++) {
                    if ($scope.conversations[index].participant == chatPartner.id) {
                        $scope.currentConversation = $scope.conversations[index];
                        if ($scope.userHasUnread(chatPartner)) {
                            $scope.markChatMessagesSeen($scope.currentConversation);
                        }
                        break;
                    }
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

        // Mark user messages as seen
        $scope.markChatMessagesSeen = function (chat) {
            if (chat) {
                $http.put("/api/conversations/user/read/" + chat.participant, {}).then(function (response) {
                    console.log(response);
                }, function (error) {
                    console.log(error);
                });
            }
        };

        // Call login
        $scope.performLogin();

        // Poll server for updates
        setInterval($scope.getMessage, 3000);

    });

    app.directive('ngNavigate', function () {
        return function ($scope, element, attrs) {
            element.bind("keydown keypress", function (event) {
                if (event.which === 13 || event.which == 37 || event.which == 38 ||
                    event.which == 39 || event.which == 40) {
                    $scope.$apply(function () {
                        $scope.$eval(attrs.ngNavigate);
                    });

                    event.preventDefault();
                }
            });
        };
    });

})
();
