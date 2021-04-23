/* global browser, chrome */

// https://github.com/coderaiser/itchy/blob/master/lib/itchy.js
var asyncEachSeries = (array, iterator, done) => {
    check(array, iterator, done);

    var i = -1,
        n = array.length;

    var loop = function (e) {
        i++;

        if (e || i === n)
            return done && done(e);

        iterator(array[i], loop);
    };

    loop();
};

function check(array, iterator, done) {
    if (!Array.isArray(array))
        throw Error('array should be an array!');

    if (typeof iterator !== 'function')
        throw Error('iterator should be a function!');

    if (done && typeof done !== 'function')
        throw Error('done should be a function (when available)!');
}

// TODO: DUPLICATE: Code duplication for browser detection in ext-lib.js, magicss.js and options.js
var isChrome = false,
    isEdge = false,
    isFirefox = false,
    isOpera = false,
    isChromiumBased = false;

// Note that we are checking for "Edg/" which is the test required for identifying Chromium based Edge browser
if (/Edg\//.test(navigator.appVersion)) {           // Test for "Edge" before Chrome, because Microsoft Edge browser also adds "Chrome" in navigator.appVersion
    isEdge = true;
} else if (/OPR\//.test(navigator.appVersion)) {    // Test for "Opera" before Chrome, because Opera browser also adds "Chrome" in navigator.appVersion
    isOpera = true;
} else if (/Chrome/.test(navigator.appVersion)) {
    isChrome = true;
} else if (/Firefox/.test(navigator.userAgent)) {   // For Mozilla Firefox browser, navigator.appVersion is not useful, so we need to fallback to navigator.userAgent
    isFirefox = true;
}
if (isEdge || isOpera || isChrome) {
    isChromiumBased = true; // eslint-disable-line no-unused-vars
}

var extLib = {
    TR: function (key, defaultValue) {
        if (typeof chrome !== "undefined" && chrome && chrome.i18n) {
            return chrome.i18n.getMessage(key);
        } else {
            if (defaultValue) {
                return defaultValue;
            } else {
                console.warn('No default value available for key: ' + key);
                return '';
            }
        }
    },

    loadCss: function (href) {
        var link = document.createElement("link");
        link.setAttribute("rel", "stylesheet");
        link.setAttribute("type", "text/css");
        link.setAttribute("href", href);
        // link.onload = function() {
        //     cb();
        // };
        // link.onerror = function() {
        //     cb('Could not load: ' + link);
        // };
        document.body.appendChild(link);
    },

    // allFrames: true
    // to support webpages structured using <frameset> (eg: http://www.w3schools.com/tags/tryhtml_frame_cols.htm)
    insertCss: function ({ treatAsNormalWebpage }, options, cb) {
        var file = options.file,
            code = options.code,
            allFrames = options.allFrames === false ? false : true,
            tabId = options.tabId || null,
            runAt = options.runAt || 'document_idle';

        if (
            !treatAsNormalWebpage &&
            typeof chrome !== "undefined" &&
            chrome &&
            chrome.tabs
        ) {
            chrome.tabs.insertCSS(tabId, {file: file, code: code, allFrames: allFrames, runAt: runAt}, function () {
                cb();       // Somehow this callback is not getting called without this anonymous function wrapper
            });
        } else {
            if (file) {
                extLib.loadCss(file);
            } else {
                console.log('Error: It appears that you are in normal webpage mode while trying to load CSS "code". Currently, that works only in extension mode.');
            }
            cb();
            // extLib.loadCss(file, function (err) {
            //     if (err) {
            //         console.error(err);
            //     } else {
            //         cb();
            //     }
            // });
        }
    },

    loadJs: function(src, cb) {
        cb = cb || function () {};
        var script = document.createElement("script");
        script.type = "text/javascript";
        script.src = src;
        script.onload = function() {
            cb();
        };
        script.onerror = function() {
            cb('Could not load: ' + src);
        };
        document.body.appendChild(script);
    },

    loadJsAsync: async function({ src }) {
        return new Promise(function (resolve, reject) { // eslint-disable-line no-unused-vars
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = src;

            script.onload = function() {
                resolve([null]);
            };
            script.onerror = function() {
                resolve(['Error in loading: ' + src]);
            };

            document.body.appendChild(script);
        });
    },

    // allFrames: true
    // to support webpages structured using <frameset> (eg: http://www.w3schools.com/tags/tryhtml_frame_cols.htm)
    executeScript: function ({ treatAsNormalWebpage }, options, cb) {
        var file = options.file,
            code = options.code,
            allFrames = options.allFrames === false ? false : true,
            tabId = options.tabId || null,
            runAt = options.runAt || 'document_idle';

        if (
            !treatAsNormalWebpage &&
            typeof chrome !== "undefined" &&
            chrome &&
            chrome.tabs
        ) {
            if (isFirefox) {
                const executing = browser.tabs.executeScript(tabId, { file: file, code: code, allFrames: allFrames, runAt: runAt });
                executing.then(function () {
                    cb();
                });
            } else {
                chrome.tabs.executeScript(tabId, { file: file, code: code, allFrames: allFrames, runAt: runAt }, function () {
                    cb();       // Somehow this callback is not getting called without this anonymous function wrapper
                });
            }
        } else {
            if (file) {
                extLib.loadJs(file, function (err) {
                    if (err) {
                        console.error(err);
                    } else {
                        cb();
                    }
                });
            } else {
                console.log('Error: It appears that you are in normal webpage mode while trying to execute JS "code". Currently, that works only in extension mode.');
                cb();
            }
        }
    },

    loadJsCss: function ({
        treatAsNormalWebpage,
        arrSources,
        allFrames,
        tabId,
        runAt,
        done
    }) {
        asyncEachSeries(
            arrSources,
            function (source, cb) {
                var sourceText, type;
                // source can also be an object and can have "src" and "skip" parameters
                if (typeof source === "object") {
                    if (source.skip) {
                        source = null;
                    } else if (source.sourceText && source.type) {
                        sourceText = source.sourceText;
                        type = source.type;
                    } else {
                        source = source.src;
                    }
                }
                if (type && sourceText) {
                    if (type === 'js') {
                        extLib.executeScript({ treatAsNormalWebpage }, {code: sourceText, allFrames: allFrames, tabId: tabId, runAt: runAt}, cb);
                    } else if (type === 'css') {
                        extLib.insertCss({ treatAsNormalWebpage }, {code: sourceText, allFrames: allFrames, tabId: tabId, runAt: runAt}, cb);
                    } else {
                        console.log('Error - Loading scripts like ' + type + '/' + source + ' is not supported by loadJsCss(). Please check the "type" for the "sourceText".');
                        cb();
                    }
                } else if (source) {
                    if (source.match('.js$')) {
                        extLib.executeScript({ treatAsNormalWebpage }, {file: source, allFrames: allFrames, tabId: tabId, runAt: runAt}, cb);
                    } else if (source.match('.css$')) {
                        extLib.insertCss({ treatAsNormalWebpage }, {file: source, allFrames: allFrames, tabId: tabId, runAt: runAt}, cb);
                    } else {
                        console.log('Error - Loading files like ' + source + ' is not supported by loadJsCss(). Please check the file extension.');
                        cb();
                    }
                } else {
                    cb();
                }
            },
            function () {
                if (done) {
                    done();
                }
            }
        );
    }
};
