var express = require("express");
var sha1 = require('sha1');
var request = require('request');
var parseString = require('xml2js').parseString;

var message = require('./util');


const server = express();
server.use(function(req,res,next){
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Headers', 'Origin,Content-Type, Content-Length');
    res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Credentials', true);
    next();
});

server.get("/",function(req,res){
    var token="weixin";
    var signature = req.query.signature;
    var timestamp = req.query.timestamp;
    var echostr   = req.query.echostr;
    var nonce     = req.query.nonce;

    var oriArray = new Array();
    oriArray[0] = nonce;
    oriArray[1] = timestamp;
    oriArray[2] = token;
    oriArray.sort();

    var original = oriArray.join('');
    var sha = sha1(original)

    if(signature === sha){
        //验证成功
        res.send(echostr)
    } else {
        //验证失败
        res.send({"message":"error"})
    }
    
});

server.post("/",function(req,res){
    var appid = "wxdfe9f2cd9bd1e303";
    var secret = "88675af2b3bb833400d0c40645eb2d51";
    console.log(123);
    request(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`,function(error, response, body){
        global.wechat_access_token = JSON.parse(body).access_token;
        //res.send("获取成功");
        try{
            var buffer = [];
            //监听 data 事件 用于接收数据
            req.on('data', function (data) {
                buffer.push(data);
            });
            //监听 end 事件 用于处理接收完成的数据
            req.on('end', function () {
                //输出接收完成的数据
                parseString(Buffer.concat(buffer).toString('utf-8'),{explicitArray : false},function(err,result){
                    if(err){
                        //打印错误信息
                        console.log(err);
                    }else{
                        //打印解析结果
                        console.log(result);
                        result = result.xml;
                        var toUser = result.ToUserName; //接收方微信
                        var fromUser = result.FromUserName;//发送仿微信
                        //判断是否是事件类型
                        if(result.Event){
                            if(result.Event==='subscribe'){
                                //回复消息
                                var xml=returntext(fromUser,toUser,'欢迎关注公众号,hahhh');
                                res.send(xml);
                            }
                        }else{
                            /**
                             * text:消息回复
                             * image:图片回复
                            */
                            switch(result.MsgType){
                                case "text":
                                    if(message[result.Content]){
                                        var xml=returntext(fromUser,toUser,message[result.Content]);
                                    }else{
                                        var xml=returntext(fromUser,toUser,'后期会增加更多功能');
                                    }
                                    res.send(xml);  
                                    break;
                                case "image":
                                    var xml=returntext(fromUser,toUser,'测试是图片类型');
                                    res.send(xml);  
                                    break;
                                default:
                                    var xml=returntext(fromUser,toUser,'回复的格式暂时不支持！');
                                    res.send(xml);  
                            }
                        }
                        
                        console.log(xml);
                    }
                })
            });
        }catch(err){
            console.log(error);
        }
    })
})

server.use(express.static(__dirname, ''));

const app = server.listen("80",()=>{
    console.log("启动了")
});

function returntext(toUser, fromUser, content){
    var xmlContent =  "<xml><ToUserName><![CDATA["+ toUser +"]]></ToUserName>";
        xmlContent += "<FromUserName><![CDATA["+ fromUser +"]]></FromUserName>";
        xmlContent += "<CreateTime>"+ new Date().getTime() +"</CreateTime>";
        xmlContent += "<MsgType><![CDATA[text]]></MsgType>";
        xmlContent += "<Content><![CDATA["+ content +"]]></Content></xml>";

    return xmlContent;
}