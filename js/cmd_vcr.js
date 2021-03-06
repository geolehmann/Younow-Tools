"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const _younow = require("./modules/module_younow");
const snapchat = require("./modules/module_snapchat");
const periscope = require("./modules/module_periscope");
const _async = require("async");
const module_log_1 = require("./modules/module_log");
const module_db_1 = require("./modules/module_db");
const dos = require("./modules/module_promixified");
const path = require("path");
const module_utils_1 = require("./modules/module_utils");
const module_www_1 = require("./modules/module_www");
function cmdVCR(settings, users) {
    return __awaiter(this, void 0, void 0, function* () {
        if (settings.younow) {
            _younow.openDB()
                .then(db => {
                _async.eachSeries(users, function (user, callback_users) {
                    user = _younow.extractUser(user);
                    _younow.resolveUser(db, user)
                        .then((userinfo) => {
                        if (userinfo.errorCode == 0) {
                            let uid = userinfo.userId;
                            let n = 0;
                            let downloadableMoments = [];
                            _async.forever(function (next) {
                                _younow.getMoments(uid, n)
                                    .then((moments) => {
                                    if (moments.errorCode == 0) {
                                        for (let moment of moments.items) {
                                            if (moment.broadcaster.userId) {
                                                module_log_1.info(moment.broadcaster.name, moment.broadcastId, module_utils_1.formatDateTime(new Date(moment.created * 1000)));
                                                downloadableMoments.push(moment);
                                            }
                                        }
                                        module_log_1.log(`current broadcast extracted ${downloadableMoments.length}`);
                                        if (moments.hasMore && moments.items.length) {
                                            n = moments.items[moments.items.length - 1].created;
                                            next(null);
                                        }
                                        else {
                                            next(new Error("FAIL"));
                                        }
                                    }
                                    else {
                                        throw new Error(`${userinfo.profile} ${userinfo.errorCode} ${userinfo.errorMsg}`);
                                    }
                                })
                                    .catch(err => {
                                    module_log_1.error(err);
                                    next(null);
                                });
                            }, function (err) {
                                if (downloadableMoments.length == 0) {
                                    callback_users();
                                }
                                else {
                                    _async.eachSeries(downloadableMoments.reverse(), function (moment, callback_moments) {
                                        _younow.downloadArchive(userinfo, moment.broadcastId, moment.created)
                                            .then(result => {
                                            callback_moments();
                                        }, err => {
                                            module_log_1.error(err);
                                            callback_moments(null);
                                        });
                                    }, callback_users);
                                }
                            });
                        }
                        else {
                            module_log_1.error(`${user} ${userinfo.errorCode} ${userinfo.errorMsg}`);
                        }
                    })
                        .catch((err) => {
                        module_log_1.error(err);
                        callback_users();
                    });
                });
            })
                .catch(module_log_1.error);
        }
        else if (settings.snapchat) {
            let db = yield new module_db_1.FakeDB().open(path.join(settings.pathConfig, "snapchat_stories.db"), "Snapchat stories");
            users.forEach((user) => __awaiter(this, void 0, void 0, function* () {
                yield snapchat.getStories(user)
                    .then((stories) => __awaiter(this, void 0, void 0, function* () {
                    if (!stories.story.snaps) {
                        stories.story.snaps = [];
                    }
                    module_log_1.log("download from", stories.story.metadata.title, stories.story.snaps.length, "Stories");
                    if (settings.json) {
                        dos.writeFile(path.join(settings.pathDownload, user + ".json"), module_log_1.prettify(stories)).catch(module_log_1.error);
                    }
                    stories.story.snaps.forEach((snap) => __awaiter(this, void 0, void 0, function* () {
                        if (snap.id in db) {
                        }
                        else {
                            module_log_1.log("download", snap.title, snap.media.type);
                            let basename = path.join(settings.pathDownload, module_utils_1.cleanFilename(`${stories.story.id}_${module_utils_1.formatDateTime(new Date(snap.captureTimeSecs * module_utils_1.Time.MILLI))}${snap.title ? "_" + snap.title : ""}`));
                            let filenameVideo = basename + ".mp4";
                            let filenameImage = basename + ".jpg";
                            switch (snap.media.type) {
                                case "VIDEO":
                                case "VIDEO_NO_SOUND":
                                    if (!(yield dos.exists(filenameVideo))) {
                                        yield module_www_1.download(snap.media.mediaUrl, filenameVideo);
                                    }
                                    break;
                                case "IMAGE":
                                    if (!(yield dos.exists(filenameImage))) {
                                        yield module_www_1.download(snap.media.mediaUrl, filenameImage);
                                    }
                                    break;
                                default:
                                    module_log_1.error("snap.media.type", snap.media.type);
                            }
                            db[snap.id] = snap;
                        }
                    }));
                }))
                    .catch(module_log_1.error);
            }));
        }
        else if (settings.periscope) {
            const db = yield new module_db_1.FakeDB().open(path.join(settings.pathConfig, "periscope.json"), "Periscope lives");
            users.forEach((user) => __awaiter(this, void 0, void 0, function* () {
                let url = periscope.parseURL(user);
                if (url) {
                    yield module_www_1.getURL(url, "utf8")
                        .then(body => {
                        try {
                            if (body) {
                                var match = body.toString().match(/data\-store\=\"(.+?)\"/i);
                                if (match) {
                                    var result = match[1];
                                    result = result.replace(/&quot;/gi, `"`);
                                    result = result.replace(/&amp;/gi, `&`);
                                    let dataStore = JSON.parse(result);
                                    try {
                                        let tokens = dataStore.SessionToken;
                                        let users = dataStore.UserCache.users;
                                        let broadcasts = dataStore.BroadcastCache.broadcasts;
                                        if (!tokens || !users) {
                                            throw "SessionToken or user is missing";
                                        }
                                        var user = users[Object.keys(users)[0]].user;
                                        return module_www_1.getURL(`${periscope.API}getUserBroadcastsPublic?user_id=${user.id}&all=true&session_id=${tokens.public.broadcastHistory.token.session_id}`)
                                            .then(json => {
                                            if (json) {
                                                let broadcasts = json.broadcasts;
                                                _async.eachSeries(broadcasts, function (broadcast, cbAsync) {
                                                    try {
                                                        if (broadcast.id == null) {
                                                            throw new Error("broadcast.id==null");
                                                        }
                                                        else if (broadcast.id in db) {
                                                            module_log_1.log(`${broadcast.id} already downloaded`);
                                                            cbAsync();
                                                        }
                                                        else {
                                                            module_log_1.log(`State:${broadcast.state} Twitter:${broadcast.twitter_username || "?"} username:${broadcast.username} nick:${broadcast.user_display_name} lang:${broadcast.language} country:${broadcast.country} city:${broadcast.city} status:${broadcast.status}`);
                                                            if (broadcast.state == "ENDED" && broadcast.available_for_replay) {
                                                                periscope.getBroadcast(broadcast.id)
                                                                    .then(video => {
                                                                    if (video.broadcast.available_for_replay) {
                                                                        let basename = periscope.createFilename(video.broadcast);
                                                                        if (settings.thumbnail) {
                                                                            periscope.downloadThumbnail(basename + ".jpg", video.broadcast).catch(module_log_1.error);
                                                                        }
                                                                        if (settings.json) {
                                                                            dos.writeFile(basename + ".json", JSON.stringify(video, null, "\t")).catch(module_log_1.error);
                                                                        }
                                                                        return periscope.downloadVideo(basename + "." + settings.videoFormat, video)
                                                                            .then(bool => {
                                                                            db[video.broadcast.id] = video.broadcast;
                                                                        })
                                                                            .catch(err => {
                                                                            module_log_1.log(`the problem is ${err}`);
                                                                        })
                                                                            .then(bool => {
                                                                            module_log_1.log(`${video.broadcast.status} downloaded`);
                                                                            cbAsync();
                                                                        });
                                                                    }
                                                                    else {
                                                                        cbAsync();
                                                                    }
                                                                })
                                                                    .catch(err => {
                                                                    module_log_1.error(err);
                                                                    cbAsync();
                                                                });
                                                            }
                                                            else {
                                                                cbAsync();
                                                            }
                                                        }
                                                    }
                                                    catch (e) {
                                                        module_log_1.error(e);
                                                        cbAsync();
                                                    }
                                                }, function () {
                                                });
                                            }
                                        });
                                    }
                                    catch (e) {
                                        module_log_1.log(dataStore);
                                        module_log_1.error(e);
                                    }
                                }
                                else {
                                    module_log_1.error("fail to parse data-store");
                                }
                            }
                        }
                        catch (e) {
                            module_log_1.error(e);
                        }
                    })
                        .catch(module_log_1.error);
                }
            }));
        }
        else {
            module_log_1.error("not implemented");
        }
    });
}
exports.cmdVCR = cmdVCR;
//# sourceMappingURL=cmd_vcr.js.map