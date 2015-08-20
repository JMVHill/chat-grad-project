(function () {
    var app = angular.module("ChatApp", []); //"pubnub.angular.service"

    app.controller("ChatController", function ($scope, $http) { // PubNub

        // Declare variables
        $scope.user = null;
        $scope.userId = null;
        $scope.chatTarget = null;
        $scope.loggedIn = false;
        $scope.conversations = [];
        $scope.currentChat = null;
        $scope.conversationString = "";
        $scope.newChatUserSearch = "";
        $scope.newChat = {active: false, hoverUser: null};
        $scope.socket = null;
        $scope.newMessage = $scope.createMessage;


        // Get information for all users in DB
        $scope.performLogin = function () {
            $http.get("/api/user").then(function (userResult) {
                $scope.loggedIn = true;
                $scope.user = userResult.data;
                $scope.userId = $scope.user._id;
                $scope.socket = io("", {query: "userId=" + $scope.userId});
                $scope.socket.on('message', $scope.SOC_GetMessage);
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


        // Constructors
        $scope.createChat = function (params) {
            var newChat = {participant: null, groupId: null, messages: [], unread: 0};
            if (params) {
                if (params.participant) {
                    newChat.participant = params.participant;
                }
                if (params.groupId) {
                    newChat.groupId = params.groupId;
                }
                if (params.messages) {
                    newChat.messages = params.messages;
                }
                if (params.unread) {
                    newChat.unread = params.unread;
                }
            }
            return newChat;
        };
        $scope.createMessage = function (params) {
            var newMessage = {from: $scope.user, body: "", sent: null};
            if (params) {
            }
            return newMessage;
        };
        $scope.createGroup = function (params) {
            var newGroup = {};
            if (params) {
            }
            return newGroup;
        };


        // Socket event methods
        $scope.SOC_GetMessage = function (message) {

            // Determine message type
            var isGroup = (message.groupId);

            // Search for conversation
            var conversationFound = false;
            for (var chatIndex = 0; chatIndex < $scope.conversations.length; chatIndex++) {
                if ((!isGroup && $scope.conversations[chatIndex].participant == message.from) ||
                    (isGroup && $scope.conversations[chatIndex].groupId == message.groupId)) {
                    $scope.conversations[chatIndex].messages.push(message);
                    conversationFound = true;
                    if ($scope.chatTarget && $scope.chatTarget.id == message.from) {
                        $scope.markChatMessagesSeen($scope.chatTarget)
                    } else {
                        $scope.conversations[chatIndex].unread = $scope.conversations[chatIndex].unread + 1;
                    }
                }
            }

            // Check if chat was found
            if (!conversationFound) {
                if (!isGroup) {
                    $scope.conversations.push($scope.createChat({
                        participant: message.from,
                        messages: [message],
                        unread: 1
                    }));
                } else {
                    $scope.conversations.push($scope.createChat({
                        groupId: message.groupId,
                        messages: [message],
                        unread: 1
                    }));
                }
            }

            // Force update of conversation
            $scope.$apply($scope.conversations);

        };


        // Socket utilisation methods
        $scope.SOC_SendMessage = function (message) {
            if (message) {
                var newDate = new Date();
                message.sent = newDate.getTime();
                message.to = $scope.chatTarget.id;
                $scope.getMessage();
                $scope.socket.emit('message', message);
                $scope.newMessage = $scope.createMessage;
            }
        };
        $scope.SOC_MarkAsSeen = function (chat) {

        };


        // New chat event methods
        $scope.newChatUserMouseOver = function (user, index) {
            if (user) {
                $scope.newChat.hover.user = user;
                $scope.newChat.hover.index = index;
            }
        };
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
        $scope.compareHoverUser = function (user) {
            return ($scope.newChat.hover && user.id == $scope.newChat.hover.user.id);
        };
        $scope.navigateNewChatUserSelect = function (event) {
            //console.log(event);
        };
        $scope.selectHoverUser = function () {
            if ($scope.newChat.users.indexOf($scope.newChat.hover.user) == -1) {
                $scope.newChat.users.push($scope.newChat.hover.user);
                $scope.newChat.hover.user = null;
                $scope.newChat.hover.index = -1;
                $scope.newChatUserSearch = "";
            }
        };
        $scope.filterUserListForNewChat = function (user) {
            var result = false;
            //console.log(user);
            if (user) {
                var searchString = user.name;
                if (!searchString) {
                    searchString = user.id;
                }
                if (searchString) {
                    result = (searchString.toLowerCase().indexOf($scope.newChatUserSearch.toLowerCase()) !== -1);
                }
                if (result && $scope.newChat.users) {
                    for (var index = 0; index < $scope.newChat.users.length; index++) {
                        if ($scope.newChat.users[index] == user) {
                            result = false;
                            break;
                        }
                    }
                }
            }
            return result;
        };
        $scope.focusNewChatFilterSearch = function () {
            document.getElementById("new-chat-filter-edit").focus();
        };
        $scope.deleteHoverUser = function (user) {
            var foundIndex = $scope.newChat.users.indexOf(user);
            if (foundIndex !== -1) {
                $scope.newChat.users.splice(foundIndex, 1);
            }
        };


        // Chat event methods
        $scope.clickSendMessage = function () {
            $scope.SOC_SendMessage($scope.newMessage);
        };


        //
        //
        //

        //
        //

        // Set the current chat target
        $scope.setChatTarget = function (chatTarget) {
            $scope.newChat = {active: false};
            $scope.chatTarget = chatTarget;
            $scope.updateChatBox(chatTarget);
        };

        // Get messages targeting the user
        $scope.getMessage = function () {
            if ($scope.user) {
                $http.get("/api/conversations/").then(function (response) {

                    console.log(response.data);

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
                        $scope.currentChat = $scope.conversations[index];
                        if ($scope.userUnreadCount(chatPartner) > 0) {
                            $scope.markChatMessagesSeen($scope.currentChat);
                        }
                        return;
                    }
                }
                $scope.currentChat = $scope.createChat({participant: chatPartner});
                $scope.conversations.push($scope.currentChat)
            } else {
                $scope.currentChat = null;
                $scope.chatTarget = null;
            }
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
                    //console.log(response);
                }, function (error) {
                    console.log(error);
                });
            }
        };

        // Call login and start http polling
        $scope.performLogin();
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
