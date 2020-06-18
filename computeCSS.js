const css = require("css");

//将css暂存进一个数组中
let rules = [];

function match(element, selector) {
    if (!selector || !element.attributes) {//按照之前构建dom树的逻辑，只有文本节点没有attributes，文本节点本身不需要匹配css
        return false;
    }
    if (selector.charAt(0) === "#") {//id
        var attr = element.attributes.filter(attr => attr.name === "id")[0];
        if (attr && attr.value === selector.replace("#", "")) {
            return true
        }
    } else if (selector.charAt(0) === ".") {//class
        var attr = element.attributes.filter(attr => attr.name === "class")[0];
        if (attr) {//匹配有空格的class， class="a b c"
            var matched = attr.value.trim().split(/\s+/).filter(className => className === selector.replace(".", "")) || [];
            return matched.length > 0;
        }
        return false
    } else {//tag
        if (element.tagName === selector) {
            return true
        }
    }
    return false
}
function specificity(selector) {//css优先级计算
    var p = [0, 0, 0, 0];
    var selectorParts = selector.split(" ");
    for (var part of selectorParts) {
        if (part.charAt(0) === "#") {
            p[1]++;
        } else if (part.charAt(0) === ".") {
            p[2]++;
        } else {
            p[3]++;
        }
    }
    return p;
}
function compare(sp1, sp2) {//css比较优先级
    if (sp1[0] - sp2[0]) {
        return sp1[0] - sp2[0];
    } else if (sp1[1] - sp2[1]) {
        return sp1[1] - sp2[1];
    } else if (sp1[2] - sp2[2]) {
        return sp1[2] - sp2[2];
    } else {
        return sp1[3] - sp2[3];
    }
}
module.exports.addCSSRules = function addCSSRules(text) {
    //媒体查询的逻辑应该在这里
    let ast = css.parse(text);
    rules.push(...ast.stylesheet.rules);
}
module.exports.computeCSS = function (element, stack) {
    //通过slice()复制数组获取父元素序列,倒序是因为匹配选择器是从内向外的
    let elements = stack.slice().reverse();
    if (!element.computedStyle) {
        element.computedStyle = {};
    }
    for (let rule of rules) {
        //toy暂时只解析" "选择器,因为不解析","所以直接取选择器数组第一项
        let selectorParts = rule.selectors[0].split(" ").reverse();//匹配选择器是从内向外的

        if (!match(element, selectorParts[0])) {//reverse后的第一条都不匹配就不需要继续匹配了，直接看下一条
            continue;
        }
        let matched = false;
        let j = 1;
        // e.g
        // elements:        child  =>  parent =>  grand
        // selectorParts:   selector3  selector2  selector1
        for (let i=0;i < elements.length;i++) {
            if (match(elements[i], selectorParts[j])) {
                j++;//匹配到的选择器个数 + 1
            }
        }
        //看哪个数组先用尽，如果选择器数组先用尽或一样则说明全部匹配了
        if (j >= selectorParts.length) {
            matched = true;
        }

        if (matched) {
            //匹配到的话，加入dom树
            let sp = specificity(rule.selectors[0]);//获取优先级
            let computedStyle = element.computedStyle;
            for (let declaration of rule.declarations) {
                if (!computedStyle[declaration.property]) {
                    computedStyle[declaration.property] = {}
                }
                if (!computedStyle[declaration.property].specificity) {
                    computedStyle[declaration.property].value = declaration.value;
                    computedStyle[declaration.property].specificity = sp;
                } else if (compare(computedStyle[declaration.property].specificity, sp) < 0) {//原有css属性优先级更低时，覆盖
                    computedStyle[declaration.property].value = declaration.value;
                    computedStyle[declaration.property].specificity = sp;
                }
            }
        }
    }
    // let inlineStyle = element.attributes.filter(p => p.name === "style");//原本inline css的处理，toy中略过
    // css.parse("* {"+ inlineStyle+"}");
    // sp = [1, 0, 0, 0];
};