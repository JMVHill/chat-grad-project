(function() {
    var app = angular.module("ChatApp", []); //"pubnub.angular.service"

    //$pubnub = angular.module('PubNubAngularApp', ["pubnub.angular.service"]);

    app.controller("ChatController", function($scope, $http) { //PubNub
        $scope.loggedIn = false;

        $http.get("/api/user").then(function(userResult) {
            $scope.loggedIn = true;
            $scope.user = userResult.data;
            $http.get("/api/users").then(function(result) {
                $scope.users = result.data;
            });
        }, function() {
            $http.get("/api/oauth/uri").then(function(result) {
                $scope.loginUri = result.data.uri;
            });
        });
    });
})();
