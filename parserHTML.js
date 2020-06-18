const computeCSS = require("./computeCSS");
const layout = require("./layout");

let currentToken = null;
let currentAttribute = null;
let stack = [{type: "document", children:[]}];
let currentTextNode = null;

function emit(token) {
    let top = stack[stack.length - 1];//栈顶
    if (token.type === "startTag") {
        let element = {
            type: "element",
            children: [],
            attributes: []
        };

        element.tagName = token.tagName;
        for (let p in token) {
            if (p !== "type" && p !== "tagName" && p !== "isSelfClosing") {
                element["attributes"].push({
                    name: p,
                    value: token[p]
                })
            }
        }
        //创建一个元素后立刻计算，因为计算css应该尽可能早，很多css规则需要依赖它的祖先节点。其他情况引入css可能会发生css重新计算、重绘、重排
        computeCSS.computeCSS(element, stack);
        top.children.push(element);
        //element.parent = top;//加一个parent指针指向父节点

        if (!token.isSelfClosing) {//如果不是自闭合标签的话进栈，等待匹配它的endTag再出栈
            stack.push(element);
        } else {
            // layout(element);//自闭合标签layout，但是toy只处理flex所以忽略
        }
        currentTextNode = null;
    } else if (token.type === "endTag") {
        if (top.tagName !== token.tagName) {
            throw new Error("Tag doesn't match!");
        } else {
            /* 遇到style标签时，添加css规则 */
            if (top.tagName === "style") {
                computeCSS.addCSSRules(top.children[0].content);//style标签下的文本节点内容
            }
            layout(top);//toy中简化处理，拿到子元素之后才layout(自闭合标签layout在start tag中).实际正常流中start tag就会开始layout
            stack.pop();
        }
        currentTextNode = null;
    } else if (token.type === "text") {
        if (currentTextNode === null) {
            currentTextNode = {
                type: "text",
                content: ""
            }
            top.children.push(currentTextNode);
        }
        currentTextNode.content += token.content;
    }
}

const EOF = Symbol("EOF");//EOF: End Of File, 唯一标识，解析结束

function data (c) {
    if (c === "<") {//开始接收open tag
        return tagOpen;
    } else if (c === EOF) {//结束
        emit({
            type: "EOF"
        });
        return ;
    } else {//接收文本
        emit({
            type: "text",
            content: c
        });
        return data;
    }
}
function tagOpen (c) {
    if (c === "/") {//这是一个end tag
        return endTagOpen;
    } else if (c.match(/^[a-zA-Z]$/)){//接收open tag的tag name，新建一个token，还不知道是不是自闭合的
        currentToken = {
            type: "startTag",
            tagName: ""
        }
        return tagName(c);
    } else if (c === ">") {
        emit(currentToken)
    } else {
        return;
    }
}
function tagName (c) {
    if (c.match(/^[\t\n\f ]$/)) {//遇到空格，说明后面要处理属性了
        return beforeAttributeName;
    } else if (c === "/") {//说明这是一个自闭合tag
        return selfClosingStartTag;
    } else if (c.match(/^[a-zA-Z]$/)) {//记录tagName,还在处理tagName
        currentToken.tagName += c;//.toLowerCase()标准里面是要转成小写的
        return tagName
    } else if (c === ">") {//tagName结束，回到data
        emit(currentToken);//提交token
        return data;
    } else {
        return tagName;
    }
}

function beforeAttributeName (c) {
    if (c.match(/^[\t\n\f ]$/)) {//如果继续是空格，继续当前状态等待属性名 <div     name
        return beforeAttributeName;
    } else if (c === "/" || c === ">" || c === EOF) {
        return afterAttributeName(c);
    } else if (c === "=") {//非法html，抛错

    } else {//正常属性名，创建一个属性节点
        currentAttribute = {
            name: "",
            value: ""
        }
        return attributeName(c);
    }
}
function attributeName(c) {
    if (c.match(/^[\t\n\f ]$/) || c === "/" || c === ">" || c === EOF) {//Reconsume in the after attribute name state.
        return afterAttributeName(c);
    } else if (c === "=") {//属性名结束，开始处理属性值
        return  beforeAttributeValue;
    } else if (c === "\u0000") {//null，异常抛错

    } else if (c === "\"" || c === "'" || c === "<") {

    } else {//正常属性名，继续接收属性名
        currentAttribute.name += c;
        return attributeName;
    }
}
function afterAttributeName(c) {
    if (c.match(/^[\t\n\f ]$/)) {
        return afterAttributeName;
    } else if (c === "/") {
        return selfClosingStartTag;
    } else if (c === "=") {
        return beforeAttributeValue;
    } else if (c === ">") {//Switch to the data state. Emit the current tag token.
        currentToken[currentAttribute.name] = currentAttribute.value;
        emit(currentToken);
        return data;
    } else if (c === EOF) {// eof-in-tag parse error

    } else {//Start a new attribute in the current tag token. Set that attribute name and value to the empty string. Reconsume in the attribute name state.
        //在当前token上记录现在这个属性名与对应属性值
        currentToken[currentAttribute.name] = currentAttribute.value;
        //开始一个新的标签属性
        currentAttribute = {
            name: "",
            value: ""
        };
        return attributeName(c);
    }
}
function beforeAttributeValue (c) {
    if (c.match(/^[\t\n\f ]$/) || c === "/" || c === ">" || c === EOF) {
        return beforeAttributeValue;
    } else if (c === "\"") {
        return doubleQuotedAttributeValue;
    } else if (c === "\'") {
        return singleQuotedAttributeValue;
    } else if (c === ">") {

    } else {//不是特殊字符，说明是无引号的属性
        return UnquotedAttributeValue(c);
    }
}
function doubleQuotedAttributeValue (c) {//双引号形式的属性值
    if (c === "\"") {//接收到另一个双引号，说明属性结束，记录属性值
        currentToken[currentAttribute.name] = currentAttribute.value;
        return afterQuotedAttributeValue;
    } else if (c === "\u0000") {//null，异常抛错

    } else if (c === EOF) {//eof-in-tag parse error

    } else {//正常记录双引号属性值
        currentAttribute.value += c;
        return doubleQuotedAttributeValue;
    }
}
function singleQuotedAttributeValue (c) {//单引号形式的属性值
    if (c === "\'") {//接收到另一个单引号，说明属性结束，记录属性值
        currentToken[currentAttribute.name] = currentAttribute.value;
        return afterQuotedAttributeValue;
    } else if (c === "\u0000") {//null，异常抛错

    } else if (c === EOF) {//eof-in-tag parse error

    } else {//正常记录单引号属性值
        currentAttribute.value += c;
        return singleQuotedAttributeValue;
    }
}
function afterQuotedAttributeValue (c) {//
    if (c.match(/^[\t\n\f ]$/)) {//空格，等待下一个属性名
        return beforeAttributeName;
    } else if (c === "/") {//自闭合标签
        return selfClosingStartTag;
    } else if (c === ">") {//标签结束，提交token并返回data状态
        currentToken[currentAttribute.name] = currentAttribute.value;
        emit(currentToken);
        return data;
    } else if (c === EOF) {//eof-in-tag parse error

    } else {//todo：存疑，标准里面这里是报错，但是示例里面是记录属性值并进入双引号属性值状态
    }
}
function UnquotedAttributeValue (c) {//无引号形式的属性值
    if (c.match(/^[\t\n\f ]$/)) {//接收到空格，说明属性值接收完了，记录属性标签, 回到等待属性名状态
        currentToken[currentAttribute.name] = currentAttribute.value;
        return beforeAttributeName;
    } else if (c === "/") {//说明是自闭合标签,当前标签解析完成
        currentToken[currentAttribute.name] = currentAttribute.value;
        return selfClosingStartTag;
    } else if (c === ">") {//当前标签完成，提交token后回到data状态
        currentToken[currentAttribute.name] = currentAttribute.value;
        emit(currentToken);
        return data;
    } else if (c === "\u0000") {//null，异常抛错

    } else if (c ==="\"" || c ==="\'" || c ==="<" || c ==="=" || c === "`") {//均属于非法的无引号形式的属性值

    } else if (c === EOF) {//eof-in-tag parse error

    } else {//正常记录无引号属性值
        currentAttribute.value += c;
        return UnquotedAttributeValue;
    }
}
function selfClosingStartTag (c) {
    if (c === ">") {//emit自闭合标签，回到data状态
        currentToken.isSelfClosing = true;
        emit(currentToken);
        return data;
    } else if (c === EOF) {//eof-in-tag parse error

    } else {//unexpected-solidus-in-tag parse error

    }
}
function endTagOpen (c) {
    if (c.match(/^[a-zA-Z]$/)) {//Create a new end tag token, set its tag name to the empty string. Reconsume in the tag name state.
        //接收end tag的tagName
        currentToken = {
            type: "endTag",
            tagName: ""
        }
        return tagName(c);
    } else if (c === ">") {//missing-end-tag-name parse error

    } else if (c === EOF) {//eof-before-tag-name parse error

    } else {//invalid-first-character-of-tag-name parse error

    }
}

module.exports.parserHTML = function parserHTML(html) { //用函数实现的状态机，一个函数代表一种状态
    let state = data;
    for (let c of html) {
        state = state(c);
    }
    state = state(EOF);
    return stack[0];
}