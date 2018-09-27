var express = require("express");
var sha1 = require('sha1');
var request = require('request');
var parseString = require('xml2js').parseString;
const bodyParser = require('body-parser');
const mysql = require("mysql");
const multer = require("multer");
const path = require("path");

var message = require('./util');
const fs = require('fs');

var wechat_config = {};

var messageData = {};

//存储token的时间
var saveTokenTime = 0;

var db = mysql.createPool({
    host: "127.0.0.1",
    user: "root",
    password: "123456",
    database: "wechat"
});


const server = express();

/**
 * 处理上传文件
*/
var objMulter = multer({
    dest: "./www/upload"
});
server.use(objMulter.any());

/**
 * 处理application/json
*/
server.use(bodyParser.json());

/**
 * 处理表单传过来的数据(application/x-www-form-urlencoded)
*/
server.use(bodyParser.urlencoded({ extended: true }));

/**
 * 处理text/plain
*/
server.use(bodyParser.text());

server.use(function (req, res, next) {
    //console.log(req.headers);
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Headers', 'Origin,Content-Type, Content-Length');
    res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, OPTIONS');
    //res.header('Access-Control-Allow-Credentials', true);

    var appid = "wxd92576a07723a758";
    var secret = "ebb5def30b8a7048bda573508b7c5bf8";

    //判断access_token是否已经过期
    if ((new Date().getTime() - saveTokenTime) < 6000000) {
        next();
        return false;
    }
    //获取token值
    request(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`, function (error, response, body) {
        global.wechat_access_token = JSON.parse(body).access_token;
        console.log(body);
        //设置毫秒数；
        saveTokenTime = new Date().getTime();
        if (!JSON.parse(body).access_token) {
            //res.send(JSON.parse(body))
            messageData = JSON.parse(body);
            next();
            return false;
        }
        // 获取jsapi_ticket
        var ticketUrl = 'https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=' + global.wechat_access_token + '&type=jsapi';
        request(ticketUrl, function (err, response, body) {
            var data = JSON.parse(body);
            if (data.errcode == 0) {
                global.jsapi_ticket = data.ticket;
                next();
            }
        })
    });
});

server.get("/", function (req, res) {
    var token = "weixin";
    var signature = req.query.signature;
    var timestamp = req.query.timestamp;
    var echostr = req.query.echostr;
    var nonce = req.query.nonce;

    var oriArray = new Array();
    oriArray[0] = nonce;
    oriArray[1] = timestamp;
    oriArray[2] = token;
    oriArray.sort();

    var original = oriArray.join('');
    var sha = sha1(original)

    if (signature === sha) {
        //验证成功
        res.send(echostr)
    } else {
        //验证失败
        res.send({ "message": "error" })
    }

});

server.post("/", function (req, res) {
    try {
        var buffer = [];
        //监听 data 事件 用于接收数据
        req.on('data', function (data) {
            buffer.push(data);
        });
        //监听 end 事件 用于处理接收完成的数据
        req.on('end', function () {
            //输出接收完成的数据
            parseString(Buffer.concat(buffer).toString('utf-8'), { explicitArray: false }, function (err, result) {
                if (err) {
                    //打印错误信息
                    console.log(err);
                } else {
                    //打印解析结果
                    console.log(result);
                    result = result.xml;
                    var toUser = result.ToUserName; //接收方微信
                    var fromUser = result.FromUserName;//发送仿微信
                    //判断是否是事件类型
                    if (result.Event) {
                        if (result.Event === 'subscribe') {
                            //回复消息
                            var xml = returntext(fromUser, toUser, '欢迎关注公众号!');
                            db.query(`INSERT INTO uert_db (openid) VALUES ('${fromUser}')`)
                            console.log(fromUser);
                            res.send(xml);
                        }
                    } else {
                        /**
                         * text:消息回复
                         * image:图片回复
                        */
                        switch (result.MsgType) {
                            case "text":
                                if (message[result.Content]) {
                                    var xml = returntext(fromUser, toUser, message[result.Content]);
                                } else {
                                    var xml = returntext(fromUser, toUser, '官人不要着急哦，后期会上线新功能，尽情期待！');
                                }
                                res.send(xml);
                                break;
                            case "image":
                                new Promise(function (resolve, reject) {
                                    var formData = {
                                        media: fs.createReadStream(__dirname + '/1.jpg'),
                                    };
                                    request.post(`https://api.weixin.qq.com/cgi-bin/media/upload?access_token=${global.wechat_access_token}&type=image`, {
                                        formData: formData,
                                    }, (err, httpResponse, body) => {
                                        console.log(body)
                                        resolve(body);
                                    });
                                }).then(function (data) {
                                    var xml = returnimage(fromUser, toUser, JSON.parse(data).media_id);
                                    res.send(xml);

                                });
                                break;
                            case "voice":
                                var xml = returntext(fromUser, toUser, '测试是语音类型类型');
                                res.send(xml);
                                break;
                            case "video":
                                var xml = returntext(fromUser, toUser, '测试是视频类型类型');
                                res.send(xml);
                                break;
                            case "shortvideo":
                                var xml = returntext(fromUser, toUser, '测试是小视频类型类型');
                                res.send(xml);
                                break;
                            case "location":
                                var xml = returntext(fromUser, toUser, '测试是地理位置类型类型');
                                res.send(xml);
                                break;
                            case "link":
                                var xml = returntext(fromUser, toUser, '测试是链接类型类型');
                                res.send(xml);
                                break;

                            default:
                                var xml = returntext(fromUser, toUser, '回复的格式暂时不支持！');
                                res.send(xml);
                        }
                    }
                }
            })
        });
    } catch (err) {
        console.log(error);
    }
});

//签名签证
server.use("/signture", function (req, res, next) {
    if (global.wechat_access_token && global.jsapi_ticket) {
        var accessToken = global.wechat_access_token;
        var jsapiTicket = global.jsapi_ticket;
        var nonceStr = Math.random().toString(36).substr(2, 15);
        var timestamp = parseInt(new Date().getTime() / 1000) + '';
        var url = req.headers.referer;
        console.log(req.headers);
        //console.log(req);

        var string = `jsapi_ticket=${jsapiTicket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;

        var signture = sha1(string);
        res.send({
            signture,
            timestamp: timestamp,
            nonceStr: nonceStr
        });
    } else {
        console.log(global.wechat_access_token, global.jsapi_ticket);
        res.send(messageData);
    }

});

//新增永久素材图片素材
server.use("/addImages", function (req, res) {

    req.files.forEach((value, index) => {
        var newPath = "www/upload/" + value.filename.substring(0, 5) + path.extname(value.originalname);
        fs.rename(value.path, newPath, function (err) {
            //res.send(newPath);
            console.log(__dirname + '/' + newPath);
            var formData = {
                media: fs.createReadStream(__dirname + '/' + newPath),
            };
            request.post("https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=" + global.wechat_access_token + "&type=image", {
                formData: formData
            }, (error, response, body) => {
                var data = JSON.parse(body);
                if (data.media_id) {
                    console.log(data.media_id)
                    console.log(data.url)
                    db.query(`INSERT INTO news_db (media_id,url) VALUES ('${data.media_id}','${data.url}')`, (err, data) => {
                        res.send(body);
                    });
                } else {
                    res.send(body);
                }
            });
        })
    })

});

//新增永久素材图文素材
server.use("/addNews", function (req, res) {
    var data = {
        "articles": [{
            "title": "测试",
            "thumb_media_id": "JiDLFOo7eak5N73bWE8YZr0PGf_txJxkGkxqNqXZLFA",
            "author": "",
            "digest": "图文消息的摘要，仅有单图文消息才有摘要，多图文此处为空。如果本字段为没有填写，则默认抓取正文前64个字",
            "show_cover_pic": 1,
            "content": "图文消息的具体内容，支持HTML标签，必须少于2万字符，小于1M，且此处会去除JS,涉及图片url必须来源接口获取。外部图片url将被过滤。",
            "content_source_url": "http://www.xiaogangji.com/about.html",
            // "need_open_comment":1,
            // "only_fans_can_comment":0
        }]
    }
    request.post({
        url: "https://api.weixin.qq.com/cgi-bin/material/add_news?access_token=" + global.wechat_access_token,
        form: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
    }, (error, response, body) => {
        var data = JSON.parse(body);
        if (data.media_id) {
            console.log(data.media_id)
            console.log(data.url)
            db.query(`INSERT INTO news_db (media_id,url) VALUES ('${data.media_id}','')`, (err, data) => {
                res.send(body);
            });
        } else {
            res.send(body);
        }
    });
});

//获取永久素材列表
server.use("/queryNewsList", function (req, res) {
    request.post({
        url: "https://api.weixin.qq.com/cgi-bin/material/batchget_material?access_token=" + global.wechat_access_token,
        form: JSON.stringify({
            type: "news",
            offset: 0,
            count: 10
        }),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },

    }, (error, response, body) => {
        res.send(body);
    });
});


//获取素材总数
server.use("/allCount", function (req, res) {
    request.get("https://api.weixin.qq.com/cgi-bin/material/get_materialcount?access_token=" + global.wechat_access_token
        , (error, response, body) => {
            res.send(body);
        })
});

//设置菜单
server.post("/setMenu", function (req, res) {
    request.post({
        url: `https://api.weixin.qq.com/cgi-bin/menu/create?access_token=${global.wechat_access_token}`,
        form: req.body.menu,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    }, (err, response, body) => {
        if (JSON.parse(body).errcode === 0) {
            db.query(`UPDATE menu_db SET menu = '${req.body.menu}' WHERE id=1`)
        }
        res.send(body);
    });
});

//获取菜单
server.get("/getMenu", function (req, res) {
    db.query(`SELECT * FROM menu_db`, (err, data) => {
        var SearchData = JSON.parse(JSON.stringify(data));
        if (err)
            console.log(err);
        else
            res.send({ menu: SearchData[0].menu });
    })
})

//群发消息
server.post("/sendAll", function (req, res) {
    //发送文字格式
    // var data = {
    //     "touser": [
    //         "oBOaL1diUyCuawBLjx24pMGRSfac",
    //         "oBOaL1diUyCuawBLjx24pMGRSfac"
    //     ],
    //     "msgtype": "text",
    //     "text": { "content": "你好，这是一个群发测试咯！不好意思，刚刚发错了！" }
    // }

    //发送图文格式
    var data = {
        "touser": [
            "oBOaL1diUyCuawBLjx24pMGRSfac",
            "oBOaL1diUyCuawBLjx24pMGRSfac"
        ],
        "mpnews":{
            "media_id":"JiDLFOo7eak5N73bWE8YZvlLydwFnU1Gf488tP4h9bo"
         },
          "msgtype":"mpnews",
          "clientmsgid":new Date().getTime(),
          "send_ignore_reprint":0
    }

    //发送图片格式
    // var data = {
    //     "touser": [
    //         "olgG75gk_kxHRUrBSNqtD0jKLawY",
    //         "olgG75gk_kxHRUrBSNqtD0jKLawY"
    //     ],
    //     "image": {
    //         "media_id": "JiDLFOo7eak5N73bWE8YZr0PGf_txJxkGkxqNqXZLFA"
    //     },
    //     "msgtype": "image"
    // }
    request.post({
        url: `https://api.weixin.qq.com/cgi-bin/message/mass/send?access_token=${global.wechat_access_token}`,
        form: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    }, (err, response, body) => {
        res.send(body);
    });
});

server.use(express.static(__dirname + '/dist'));

const app = server.listen("80", () => {
    console.log("启动了")
});

//回复文字信息
function returntext(toUser, fromUser, content) {
    var xmlContent = `<xml><ToUserName><![CDATA[${toUser}]]></ToUserName>
                        <FromUserName><![CDATA[${fromUser}]]></FromUserName>
                        <CreateTime>${new Date().getTime()}</CreateTime>
                        <MsgType><![CDATA[text]]></MsgType>
                        <Content><![CDATA[${content}]]></Content>
                    </xml>`;

    return xmlContent;
}

function returnimage(toUser, fromUser, mediaId) {
    var xmlContent = `<xml>
                        <ToUserName><![CDATA[${toUser}]]></ToUserName>
                        <FromUserName><![CDATA[${fromUser}]]></FromUserName>
                        <CreateTime>${new Date().getTime()}</CreateTime>
                        <MsgType><![CDATA[image]]></MsgType>
                        <Image><MediaId><![CDATA[${mediaId}]]></MediaId></Image>
                    </xml>`;

    return xmlContent;
}