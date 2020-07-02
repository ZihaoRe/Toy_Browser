const http = require("http");
const server = http.createServer((req, res) => {
    console.log("request received");
    console.log(req.headers);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Foo', 'bar');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`<html>
<head>
    <style>
        #father-flex {
            display: flex;
            width:200px;
            background-color: rgb(25,255, 255 );
        }
        #flex0{
            width:100px;
            height: 100px;
            background-color: rgb(255,123,1);
        }
        .flex1{
            width:30px;
            height: 30px;
            background-color: rgb(21,123,1);
        }
    </style>
</head>
<body>
<div id="father-flex">
    <div id="flex0"></div>
    <div class="flex1"></div>
</div>
</body>
</html>`);
});
server.listen(8088);