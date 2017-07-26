var app = angular.module("myApp", []); 
app.controller("myCtrl", function($scope) {
    // get baha id, nickname
    $scope.txtBahaId = '';
    chrome.cookies.get({"url": 'https://www.gamer.com.tw', "name": 'BAHAID'}, function(cookie) {
        if (cookie) {
            console.log(`BahaId=${cookie.value}`);
            $scope.txtBahaId += cookie.value + ' / ';
        }
    });
    chrome.cookies.get({"url": 'https://www.gamer.com.tw', "name": 'BAHANICK'}, function(cookie) {
        if (cookie) {
            console.log(`BahaId=${cookie.value}`);
            $scope.txtBahaId += decodeURI(cookie.value) + ' / ';
        }
    });

    // get logs
    chrome.storage.local.get('logs', function (result) {
        if (result.logs) {
            $scope.list = result.logs.reverse();
        }
        
        $scope.$apply();
    });
});

