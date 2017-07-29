chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.tabs.create({ url: 'option.html' });
});

const g_domain = 'https://www.gamer.com.tw';
const delay = 15;
// var lastSigninDate = -1; // 上次簽到日期
// var lastFailSigninDate = -1; // 上次登入失敗日期

/**
 * state:
 * -2:  網路錯誤
 * -1:  檢查失敗，使用者未登入
 *  0:  檢查成功。今日尚未簽到  
 *  1:  已簽到 
 *  2:  簽到成功
 */
const stateMsg = {
    '-3': '簽到失敗',
    '-2': '網路錯誤',
    '-1': '檢查失敗，使用者未登入',
    '0':  '今日尚未簽到',
    '1':  '今日已簽到',
    '2':  '簽到成功'
}

var SetBadge = {
    'success': () => {
        chrome.browserAction.setBadgeText({text: '✓'})
        chrome.browserAction.setBadgeBackgroundColor({color: 'green'})
    },
    'waiting': () => {
        chrome.browserAction.setBadgeText({text: '..'})
        chrome.browserAction.setBadgeBackgroundColor({color: 'orange'})
    },
    'fail': () => {
        chrome.browserAction.setBadgeText({text: '!'})
        chrome.browserAction.setBadgeBackgroundColor({color: 'red'})
    }
}

var Logs = {
    logs: [],
    lastSignin: {
        success: -1,
        fail: -1
    },
    init: function() {
        chrome.storage.local.get('logs', function (result) {
            if (result.logs) {
                Logs.logs = result.logs;
            }
        });
        chrome.storage.local.get('lastSignin', function (result) {
            if (result.lastSignin) {
                if (result.lastSignin.success) Logs.lastSignin.success = result.lastSignin.success;
                if (result.lastSignin.fail) Logs.lastSignin.fail = result.lastSignin.fail; 
            }
        });
    },
    log: function(state) {
        if (this.logs.length > 100) this.logs.pop(); // max 100 logs
        // norminalize date format
        var s = (new Date()).toLocaleString().replace(/:\d+$/, '');
        s = s + (' ').repeat(21-s.length);
        this.logs.push({
            'date': s,
            'state': state,
            'msg': stateMsg[state.toString()]
        });
        chrome.storage.local.set({'logs': this.logs});
    },
    UpdatelastSignin: function(obj) {
        if (obj.success) this.lastSignin.success = obj.success;
        if (obj.fail) this.lastSignin.fail = obj.fail;
        chrome.storage.local.set({'lastSignin': this.lastSignin});
    }
}

// 檢查簽到狀態
function CheckSignState() { 
    return new Promise((resolve, reject) => {
        $.ajax({
            method: "post",
            url: g_domain+"/ajax/signin.php?_2",
            data: {
                action: 2
            },
            dataType: "json",
            cache: !1
        }).done(function(r) {
            /**
             *  not  login: {signin: -1}
             *  not sign: {"signin":0,"days":6}
             *  signed: {signin: 1}
             */
            console.log(r);
            if (r.signin == -1) {
                // reject('not login');
                reject(-1);
            }
            else if (r.signin == 0) {
                // reject('not yet');
                reject(0);
            }
            else if (r.signin == 1) {
                resolve(1);
            }
        }).fail(function(){
            // reject('network error.');
            reject(-2);
        });
    });
}

function GetToken() {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: g_domain+"/ajax/get_csrf_token.php",
            cache: !1
        }).done(function(r) {
            if (r.length > 0) {
                // resolve(r);
                resolve(r); // get token
            }
            else {
                // reject('get token error');
                reject(-1); // not login
            }
        }).fail(function(){
            reject('network error.');
        });
    })
}

function Signin(token) {
    return new Promise((resolve, reject) => {
        $.ajax({
            method: "post",
            url: g_domain+"/ajax/signin.php?_1",
            data: {
                action: 1,
                token: token
            },
            dataType: "json",
            cache: !1
        }).done(function(r) {
            console.log(r);
            /**
             * {code: -2, message: "今天您已經簽到過了喔"}
             * {code: -4, message: "網頁已過期，請重新嘗試!"}
             * {nowd: 9, days: 7, message: "簽到成功"}
             */
            if (r.message=="簽到成功") {
                // resolve('signin success');
                resolve(2);
            }
            else {
                // resolve('fail');
                resolve(-3); // signin error
            }

        }).fail(function(){
            // reject('network error.');
            reject(-2);
        });
    })
}

// Alarm Interval function
function Singin_TimerInterval() {
    console.log('Signin() called.');
    var currentDate = (new Date()).getDate();

    if (Logs.lastSignin.success != currentDate || // 目前簽到日期 != 上次簽到日期 (日期變更)
        Logs.lastSignin.success == -1) { // 尚未有遷到紀錄 (首次執行時)
        SetBadge.waiting();

        // 進行檢查簽到狀態
        CheckSignState().then((r) => {
            // 檢查之後 已簽到
            console.log(r);
            console.log("已簽到");
            // lastSigninDate = currentDate;
            // lastFailSigninDate = -1;
            // Logs.lastFailSigninDate = currentDate;
            SetBadge.success();
            Logs.UpdatelastSignin({success: currentDate, fail: -1});
            Logs.log(r); // log

        }).catch((r) => {
            // 檢查之後 發現沒有簽到過
            console.log(r);
            
            if (r == 0) {
                console.log("已登入，但尚未簽到");
                // get token
                GetToken().then((token) => {
                    // signin
                    Signin(token).then((r) => {
                        // singin success
                        console.log("簽到成功");
                        // lastSigninDate = currentDate;
                        // lastFailSigninDate = -1;
                        SetBadge.success();
                        Logs.UpdatelastSignin({success: currentDate, fail: -1});
                        Logs.log(r); // log
                    }).catch((err) => {
                        // singin error
                        SetBadge.fail();
                        console.log(err);
                        Logs.log(err); // log
                    });
                }).catch((err) => {
                    // gettoken error
                    SetBadge.fail();
                    console.log('get token error');
                    console.log(err);
                    Logs.log(r); // log
                });
            }
            else {
                console.log('檢查錯誤');
                SetBadge.fail();
                console.log(stateMsg[r.toString()]);
                if (Logs.lastSignin.fail != currentDate) {
                    // log error one time a day.
                    Logs.UpdatelastSignin({fail: currentDate});
                    Logs.log(r);
                }
            }
        });

    }
}

function onAlarm(alarm) {
    console.log('Got alarm', alarm);
    if (alarm && alarm.name == 'signin') {
        Singin_TimerInterval();
        chrome.alarms.create('signin', {periodInMinutes: delay});
    } 
}

function main() {
    console.log('main()');
    Logs.init();
    chrome.alarms.onAlarm.addListener(onAlarm);
    chrome.alarms.create('signin', {periodInMinutes: delay});
}

main();

// CLI
function Clear_lastSign() {
    chrome.storage.local.remove('lastSignin');
    Logs.lastSignin = {
        success: -1,
        fail: -1
    };
}