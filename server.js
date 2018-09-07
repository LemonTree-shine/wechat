var express = require("express");
var sha1 = require('sha1');


const server = express();
server.use(function(req,res,next){
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Headers', 'Origin,Content-Type, Content-Length');
    res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Credentials', true);
    next();
});

server.use("/wechat",function(req,res){
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

server.use(express.static(__dirname, ''));

const app = server.listen("80",()=>{
    console.log("启动了")
});