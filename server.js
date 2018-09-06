var express = require("express");
var jsSHA = require('jssha');


const server = express();

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
    var shaObj = new jsSHA(original, 'TEXT');
    var scyptoString=shaObj.getHash('SHA-1', 'HEX'); 

    if(signature == scyptoString){
        //验证成功
    } else {
        //验证失败
    }
});

const app = server.listen("80",()=>{
    console.log("启动了")
});