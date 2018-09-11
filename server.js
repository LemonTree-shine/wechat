var express = require("express");
var sha1 = require('sha1');
var request = require('request');
var parseString = require('xml2js').parseString;

var message = require('./util');
const fs = require('fs');

// var redis = require("redis"); 
// var client = redis.createClient(); 
// client.on("error", function (err) {  
// console.log("Error :" , err);  
// });  

// client.on('connect', function(){  
// console.log('Redis连接成功.');  
// }) 

var wechat_config = {};

var messageData = {};


const server = express();
server.use(function (req, res, next) {
    console.log(req.headers);
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Headers', 'Origin,Content-Type, Content-Length');
    res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, OPTIONS');
    //res.header('Access-Control-Allow-Credentials', true);
    if(req.url==="/signture"){
        var appid = "wx6e3bf6cb641b5d35";
        var secret = "b9dff0e88a68b4a818d065d4ea8d5c35";
        //判断是否有access_token和jsapi_ticket
        if(global.wechat_access_token&&global.jsapi_ticket){
            next();
            return false;
        }
        //获取token值
        request(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`, function (error, response, body) {
            global.wechat_access_token = JSON.parse(body).access_token;
            if(!JSON.parse(body).access_token){
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
        })
    }else{
        next();
    } 
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
                            var xml = returntext(fromUser, toUser, '欢迎关注公众号,hahhh');
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
                                    var xml = returntext(fromUser, toUser, '后期会增加更多功能');
                                    //var xml = returnlink(fromUser,toUser,"测试aaa","描述AAA",result.Content,"293845736")
                                }
                                res.send(xml);
                                break;
                            case "image":
                                
                                new Promise(function (resolve, reject) {
                                    var formData = {
                                        media: fs.createReadStream(__dirname+'/1.png'),
                                    };
                                    request.post(`https://api.weixin.qq.com/cgi-bin/media/upload?access_token=${global.wechat_access_token}&type=image`, {
                                        formData: formData,
                                    }, (err, httpResponse, body) => {
                                        console.log(body)
                                        resolve(body);
                                    });
                                }).then(function (data) {
                                    // request(`https://api.weixin.qq.com/cgi-bin/media/get?access_token=${global.wechat_access_token}&media_id=${JSON.parse(data).media_id}`, function (error, response, body) {
                                    //     console.log(11111111111111);
                                    //     console.log(JSON.parse(data).media_id);
                                    // })
                                    var xml = returnimage(fromUser, toUser, JSON.parse(data).media_id);
                                    console.log(11111111111111);
                                    console.log(xml)
                                    res.send(xml);
                                    
                                });
                                //returnimage()
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
server.use("/signture",function(req,res,next){
    if(global.wechat_access_token&&global.jsapi_ticket){
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
            timestamp:timestamp,
            nonceStr:nonceStr
        });
    }else{
        console.log(global.wechat_access_token,global.jsapi_ticket);
        res.send(messageData);
    }
    
});

server.use(express.static(__dirname+'/dist'));

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