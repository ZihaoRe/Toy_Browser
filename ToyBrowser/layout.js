function getStyle(element) {//对样式信息预处理
    if (!element.style) {
        element.style = {};
    }
    for (let prop in element.computedStyle) {
        var p = element.computedStyle.value;
        element.style[prop] = element.computedStyle[prop].value;

        if (element.style[prop].toString().match(/px$/)
            || element.style[prop].toString().match(/^[0-9\.]+$/)) {//toy只处理px
            element.style[prop] = parseInt(element.style[prop]);
        }
    }
    return element.style;
}
function layout (element) {
    if (!element.computedStyle) {
        return;
    }
    var elementStyle = getStyle(element);
    if (elementStyle.display !== "flex") {//
        return;
    }
    var items = element.children.filter(e => e.type === "element");//只处理children中的元素节点
    items.sort((a, b) => (a.order || 0) - (b.order || 0));

    var style = elementStyle;

    ['width', 'height'].forEach(size => {
        if (style[size] === "auto" || style[size] === '') {
            style[size] = null;
        }
    })

    //设置flex的一些默认值
    if (!style.flexDirection || style.flexDirection === "auto") {
        style.flexDirection = "row";
    }
    if (!style.alignItems || style.alignItems === "auto") {
        style.alignItems = "stretch";
    }
    if (!style.justifyContent || style.justifyContent === "auto") {
        style.justifyContent = "flex-start";
    }
    if (!style.flexWrap || style.flexWrap === "auto") {
        style.flexWrap = "nowrap";
    }
    if (!style.alignContent || style.alignContent === "auto") {
        style.alignContent = "stretch";
    }

    var mainSize, mainStart, mainEnd, mainSign, mainBase,//主轴
        crossSize, crossStart, crossEnd, crossSign, crossBase;//交叉轴
    if (style.flexDirection === "row") {
        mainSize = "width";
        mainStart = "left";
        mainEnd = "right";
        mainSign = +1;//主轴方向
        mainBase = 0;

        crossSize = "height";
        crossStart = "top";
        crossEnd = "bottom";
    } else if (style.flexDirection === "row-reverse") {
        mainSize = "width";
        mainStart = "right";
        mainEnd = "left";
        mainSign = -1;//主轴方向
        mainBase = style.width;//反向时起点为元素宽度的位置

        crossSize = "height";
        crossStart = "top";
        crossEnd = "bottom";
    } else if (style.flexDirection === "column") {//竖直方向
        mainSize = "height";
        mainStart = "top";
        mainEnd = "bottom";
        mainSign = +1;
        mainBase = 0;

        crossSize = "width";
        crossStart = "left";
        crossEnd = "right";
    } else if (style.flexDirection === "column-reverse") {
        mainSize = "height";
        mainStart = "bottom";
        mainEnd = "top";
        mainSign = -1;
        mainBase = style.height;

        crossSize = "width";
        crossStart = "left";
        crossEnd = "right";
    }

    if (style.flexWrap === "wrap-reverse") {//交叉轴reverse
        var tmp = crossStart;
        crossStart = crossEnd;
        crossEnd = tmp;
        crossSign = -1;
    } else {
        crossBase = 0;
        crossSign = +1;
    }

    //处理特例
    var isAutoMainSize = false;
    if (!style[mainSize]) {//没有设置mainSize，auto sizing, mainSize通过子元素mainSize累加获得
        elementStyle[mainSize] = 0;
        for (let i = 0; i < items.length; i++) {
            let itemStyle = getStyle(items[i]);
            if (itemStyle[mainSize] !== null || itemStyle[mainSize] !== undefined) {
                elementStyle[mainSize] += itemStyle[mainSize];
            }
            isAutoMainSize = true;
        }
    }

    //收集子元素进行，分行只跟mainSize有关
    var flexLine = [];
    var flexLines = [flexLine];

    var mainSpace = elementStyle[mainSize];//该行剩余空间
    var crossSpace = 0;

    for (let i = 0; i < items.length; i++) {
        let item = items[i];
        let itemStyle = getStyle(item);

        if (itemStyle[mainSize] === null || itemStyle[mainSize] === undefined) {
            itemStyle[mainSize] = 0;
        }
        if (itemStyle.flex) {//flex时可伸缩，这行一定放得下
            flexLine.push(item);
        } else if (style.flexWrap === "nowrap" && isAutoMainSize) {//nowrap不换行,isAutoMainSize说明父容器宽度是auto，一定放得下
            mainSpace -= itemStyle[mainSize];
            if (itemStyle[crossSize] !== null && itemStyle[crossSize] !== undefined) {
                crossSpace = Math.max(crossSpace, itemStyle[crossSize]);//crossSize取改行最大的crossSize
            }
            flexLine.push(item);
        } else {
            if (itemStyle[mainSize] > style[mainSize]) {//子元素比整行都宽，缩小子元素尺寸
                itemStyle[mainSize] = style[mainSize];
            }
            if (mainSpace < itemStyle[mainSize]) {//放不下，换行
                flexLine.mainSpace = mainSpace;//记录剩余空间
                flexLine.crossSpace = crossSpace;
                flexLine = [item];//放到下一行
                flexLines.push(flexLine);
                mainSpace = style[mainSize];//重置
                crossSpace = 0;//重置
            } else {//继续放
                flexLine.push(item);
            }
            if (itemStyle[crossSize] !== null && itemStyle[crossSize] !== undefined) {
                crossSpace = Math.max(crossSpace, itemStyle[crossSize]);//crossSize取改行最大的crossSize
            }
            mainSpace -= itemStyle[mainSize];
        }
    }
    //全部子元素放完了，处理最后一行
    flexLine.mainSpace = mainSpace;
    if (style.flexWrap === "nowrap" || isAutoMainSize) {
        flexLine.crossSpace = (style[crossSize] !== undefined) ? style[crossSize] : crossSpace;
    } else {
        flexLine.crossSpace = crossSpace;
    }

    //计算元素主轴位置
    if (mainSpace < 0) {//剩余空间为负数，只存在于单行情况，缩放这行的子元素
        var scale = style[mainSize] / (style[mainSize] - mainSpace);
        var currentMain = mainBase;//主轴起点
        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            let itemStyle = getStyle(item);

            if (itemStyle.flex !== null && itemStyle.flex !== undefined) {//flex元素在宽度不够的情况下先被压为0
                itemStyle[mainSize] = 0;
            } else {//其他元素缩放
                itemStyle[mainSize] = itemStyle[mainSize] * scale;
            }

            itemStyle[mainStart] = currentMain;
            itemStyle[mainEnd] = itemStyle[mainStart] + mainSign * itemStyle[mainSize];
            currentMain = itemStyle[mainEnd];
        }
    } else {//一般情况
        flexLines.forEach(items => {
            let mainSpace = items.mainSpace;
            let flexTotal = 0;
            for (let i = 0; i < items.length; i++) {
                let item = items[i];
                let itemStyle = getStyle(item);

                if (itemStyle.flex !== null && itemStyle.flex !== undefined) {
                    flexTotal += itemStyle.flex;
                }
            }

            if (flexTotal > 0) {//存在flex元素
                let currentMain = mainBase;
                for (let i = 0; i < items.length; i++) {
                    let item = items[i];
                    let itemStyle = getStyle(item);

                    if (itemStyle.flex !== null && itemStyle.flex !== undefined) {
                        //根据flex比例来计算实际的子元素mainSize
                        itemStyle[mainSize] = (mainSpace / flexTotal) / itemStyle.flex;
                    }

                    itemStyle[mainStart] = currentMain;
                    itemStyle[mainEnd] = itemStyle[mainStart] + mainSign * itemStyle[mainSize];
                    currentMain = itemStyle[mainEnd];
                }
            } else {//不存在flex元素，存在剩余空间，此时justifyContent有效
                var currentMain, step;
                if (style.justifyContent === "flex-start") {//从start排列(默认)
                    currentMain = mainBase;
                    step = 0;
                } else if (style.justifyContent === "flex-end") {//从end排列
                    currentMain = mainSpace * mainSign + mainBase;
                    step = 0;
                } else if (style.justifyContent === "center") {//中间对齐
                    currentMain = mainSpace / 2 * mainSign + mainBase;
                    step = 0;
                } else if (style.justifyContent === "space-between") {
                    step = mainSpace / (items.length - 1) * mainSign;
                    currentMain = mainBase;
                } else if (style.justifyContent === "space-around") {
                    step = mainSpace / items.length * mainSign;
                    currentMain = step / 2 + mainBase;
                }
                for (let i = 0; i < items.length; i++) {
                    let item = items[i];
                    let itemStyle = getStyle(item);
                    itemStyle[mainStart] = currentMain;
                    itemStyle[mainEnd] = itemStyle[mainStart] + mainSign * itemStyle[mainSize];
                    currentMain = itemStyle[mainEnd] + step;
                }
            }
        })
    }
    //计算元素交叉轴位置
    var crossSpace;

    if (!style[crossSize]) {//父元素没有设置crossSize，auto sizing
        crossSpace = 0;
        style[crossSize] = 0;
        for (let i = 0; i < flexLines.length; i++) {
            style[crossSize] += flexLines[i].crossSpace;
        }
    } else {
        crossSize = style[crossSize];
        for (let i = 0; i < flexLines.length; i++) {
            style[crossSize] -= flexLines[i].crossSpace;
        }
    }

    crossBase = style.flexWrap === "wrap-reverse" ? crossBase = style[crossSize] : 0;

    let lineSize = style[crossSize] / flexLines.length;

    let step;
    //交叉轴上各行的对齐方式处理
    if (style.alignContent === "flex-start") {
        crossBase += 0;
        step = 0;
    } else if (style.alignContent === "flex-end") {
        crossBase += crossSign * crossSpace;
        step = 0;
    } else if (style.alignContent === "center") {
        crossBase += crossSign * crossSpace / 2;
        step = 0;
    } else if (style.alignContent === "space-between") {
        crossBase += 0;
        step = crossSpace / (flexLines.length - 1);
    } else if (style.alignContent === "space-around") {
        step = crossSpace / flexLines.length;
        crossBase += crossSign * step / 2;
    } else if (style.alignContent === "stretch") {
        crossBase += 0;
        step = 0;
    }

    flexLines.forEach(items => {

        let lineCrossSize =
            style.alignContent === 'stretch'//均匀分布项目, 拉伸‘自动’-大小的项目以充满容器
                ? items.crossSpace + crossSpace / flexLines.length
                : items.crossSpace

        for (let i = 0; i < items.length; i++) {
            let item = items[i]
            let itemStyle = getStyle(item)

            let align = itemStyle.alignSelf || style.alignItems

            if (itemStyle[crossSize] === null) {
                itemStyle[crossSize] = align === 'stretch' ? lineCrossSize : 0
            }
            if (align === 'flex-start') {
                itemStyle[crossStart] = crossBase
                itemStyle[crossEnd] =
                    itemStyle[crossStart] + crossSign * itemStyle[crossSize]
            }
            if (align === 'flex-end') {
                itemStyle[crossEnd] = crossBase + crossSign * lineCrossSize
                itemStyle[crossStart] =
                    itemStyle[crossEnd] - crossSign * itemStyle[crossSize]
            }
            if (align === 'center') {
                itemStyle[crossStart] =
                    crossBase + (crossSign * (lineCrossSize - itemStyle[crossSize])) / 2
                itemStyle[crossEnd] =
                    itemStyle[crossStart] + crossSign * itemStyle[crossSize]
            }
            if (align === 'stretch') {
                itemStyle[crossStart] = crossBase
                itemStyle[crossEnd] =
                    crossBase +
                    crossSign *
                    (itemStyle[crossSize] !== null && itemStyle[crossSize] !== undefined
                        ? itemStyle[crossSize]
                        : lineCrossSize)

                itemStyle[crossSize] =
                    crossSign * (itemStyle[crossEnd] - itemStyle[crossStart])
            }
        }
        crossBase += crossSign * (lineCrossSize + step)
    })
    console.log(items)
}

module.exports = layout;