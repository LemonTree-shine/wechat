var express = require("express");

const server = express();

server.use("/wechat",function(req,res){
    res.send("成功");
});

const app = server.listen("80");