// ==UserScript==
// @name         磁力搜自动采集
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  添加一个采集按钮到页面右上角，执行自动采集解析规则的操作
// @homeurl      https://github.com/xiandanin/LardMonkeyScripts
// @homeurl      https://greasyfork.org/zh-CN/scripts/392361
// @author       xiandan
// @match        *://*/*
// @grant        none
// ==/UserScript==
(function () {
    'use strict'

    let button = document.createElement('button')
    button.innerText = "采集"
    button.style.position = 'fixed'
    button.style.padding = '2px 6px'
    button.style.top = '0'
    button.style.right = '0'
    button.style.zIndex = '99999'
    button.style.borderRadius = '4px'
    button.style.color = "#606266"
    button.style.border = "1px solid #dcdfe6"
    button.style.backgroundColor = "#fff"
    button.style.opacity = "0.8"
    button.onclick = exec
    document.body.appendChild(button)

    function exec () {
        // 分析出关键词
        let inputNodes = document.getElementsByTagName('input')
        let keyword
        for (let i = 0; i < inputNodes.length; i++) {
            const value = inputNodes[i].value
            if (value && inputNodes[i].style.display !== "none"
                && inputNodes[i].style.visibility !== "hidden"
                && inputNodes[i].getAttribute('type') !== "hidden") {
                keyword = value
                break
            }
        }
        if (!keyword) {
            console.log('没有分析出关键词')
            return
        }
        console.info('关键词：%s', keyword)

        // 遍历所有超链接 找出第3个包含关键词的节点
        let aNode
        let aNodes = document.getElementsByTagName('a')
        let aNodeCount = 0
        for (let i = 0; i < aNodes.length; i++) {
            if (new RegExp(`${keyword}`, 'gi').test(aNodes[i].innerText)
                || /magnet/gi.test(aNodes[i].getAttribute('href'))) {
                aNode = aNodes[i]
                aNodeCount++
            }
            if (aNodeCount >= 3) {
                break
            }
        }
        if (!aNode) {
            console.log('没有分析出合适的链接')
            return
        }

        const dateRegx = '(\\d{4})-(\\d{1,2})-(\\d{1,2})|ago|前'
        const sizeRegx = '\\d.*(字节|bytes|KB|MB|GB|TB|PB|EB|ZB|YB)'
        const magnetRegx = '(magnet:\\?xt).*'
        const hotRegx = '(^\\d+$)|(热度|hot)'

        // 递归向上找出group
        function findItemGroupNode (node) {
            const parentNode = node.parentNode
            const regx = new RegExp(`(?=[\\s\\S]*${keyword})(?=[\\s\\S]*(${dateRegx}))(?=[\\s\\S]*(${sizeRegx}))^[\\s\\S]*$`, 'gi')
            if (regx.test(parentNode.textContent)) {
                return parentNode
            } else {
                return findItemGroupNode(parentNode)
            }
        }

        const childNodes = []

        function findAllChildNode (node) {
            let children = node.children
            for (let i = 0; i < children.length; i++) {
                // 递归遍历
                childNodes.push(children[i])
                if (children[i].children.length > 0) {
                    findAllChildNode(children[i])
                }
            }
        }

        function findItemValueNode (regx, attr) {
            for (let i = childNodes.length - 1; i >= 0; i--) {
                // 先检查文字
                if (regx.test(childNodes[i].innerText)) {
                    return {
                        node: childNodes[i],
                        attrPath: ''
                    }
                }

                // 再检查属性
                if (attr) {
                    let attributeNames = childNodes[i].getAttributeNames()
                    for (let j = 0; j < attributeNames.length; j++) {
                        if (regx.test(childNodes[i].getAttribute(attributeNames[j]))) {
                            return {
                                node: childNodes[i],
                                attrPath: `/@${attributeNames[j]}`
                            }
                        }
                    }
                }
            }
        }

        function getRootPathTo (element) {
            let tagName = element.tagName.toLowerCase()
            if (element.id) {
                return `${tagName}[@id='${element.id}']`
            }
            if (element.className) {
                return `${tagName}[@class='${element.className}']`
            }
            let parentNode = element.parentNode
            if (parentNode.className) {
                return `${parentNode.tagName.toLowerCase()}[@class='${parentNode.className}']/${tagName}`
            }
            if (element === document.body) {
                return tagName
            }
            return getNumberPathTo(element)
        }

        function getNumberPathTo (element) {
            let tagName = element.tagName.toLowerCase()
            if (element === document.body) {
                return tagName
            }
            let ix = 0
            let siblings = element.parentNode.childNodes
            for (let i = 0; i < siblings.length; i++) {
                let sibling = siblings[i]
                if (sibling === element) {
                    return `${getNumberPathTo(element.parentNode)}/${tagName}[${ix + 1}]`
                }
                if (sibling.nodeType === 1 && sibling.tagName.toLowerCase() === tagName) {
                    ix++
                }
            }
        }

        function findSortPaths (rootUrl) {
            function formatPath (path) {
                return decodeURIComponent(path).replace(rootUrl, '')
                    .replace(new RegExp(`${keyword}`, 'gi'), '{k}')
                    .replace(/\d+/, '{p}')
            }

            let preset = formatPath(window.location.href.replace(rootUrl, ''))
            const paths = {preset}

            const sortRegx = {
                time: /.*时间.*|.*time.*/gi,
                size: /.*大小.*|.*size.*/gi,
                hot: /..*点击.*|.*人气.*|.*次数.*|.*hot.*|.*count.*|.*click.*/gi
            }
            let aNodes = document.getElementsByTagName('a')
            for (let i = 0; i < aNodes.length; i++) {
                let linkText = aNodes[i].innerText
                let href = aNodes[i].getAttribute('href')
                for (let key in sortRegx) {
                    if (href && sortRegx[key].test(linkText)) {
                        const keyPath = formatPath(href)
                        if (keyPath !== preset) {
                            paths[key] = keyPath
                        }
                    }
                }
            }
            return paths
        }

        const groupNode = findItemGroupNode(aNode)
        if (!groupNode) {
            console.log('没有分析出合适的Group')
            return
        }
        console.log('找到Group', groupNode)
        findAllChildNode(groupNode)
        const dateWrapper = findItemValueNode(new RegExp(dateRegx, 'gi'))
        const sizeWrapper = findItemValueNode(new RegExp(sizeRegx, 'gi'))
        let magnetWrapper = findItemValueNode(new RegExp(magnetRegx, 'gi'), true)
        const hotWrapper = findItemValueNode(new RegExp(hotRegx, 'gi'))

        let hostnameArray = window.location.hostname.split('.')
        const id = hostnameArray[hostnameArray.length >= 3 ? Math.floor(hostnameArray.length / 2) : 0]
        const url = `${window.location.protocol}//${window.location.host}`

        const titleSplit = document.title.split('-')
        const title = titleSplit[parseInt(titleSplit.length / 2)]

        const icon = `${url}/favicon.ico`
        const paths = findSortPaths(url)

        // xpath
        const groupNumberPath = getNumberPathTo(groupNode)
        const group = `//${getRootPathTo(groupNode)}`
        if (!magnetWrapper) {
            magnetWrapper = {node: aNode, attrPath: '/@href'}
            console.info('没有找到磁力链，将使用详情链接代替，请检查')
        }
        const magnet = `.${getNumberPathTo(magnetWrapper.node).replace(groupNumberPath, '')}${magnetWrapper.attrPath}`
        const name = `.${getNumberPathTo(aNode).replace(groupNumberPath, '')}`
        const size = `.${getNumberPathTo(sizeWrapper.node).replace(groupNumberPath, '')}`
        const date = `.${getNumberPathTo(dateWrapper.node).replace(groupNumberPath, '')}`
        const hot = hotWrapper ? `.${getNumberPathTo(hotWrapper.node).replace(groupNumberPath, '')}` : undefined
        const xpath = {
            group, magnet, name, size, date, hot
        }
        const item = {
            id, name: title, url, icon, paths, xpath
        }

        const xVerUrl = item.url + item.paths[Object.keys(item.paths)[0]]
        const xVer = {
            site: item.name,
            waiting: "0",
            group: item.xpath.group,
            magnet: item.xpath.magnet,
            name: item.xpath.name,
            size: item.xpath.size,
            count: item.xpath.date,
            source: xVerUrl.replace(/{k}/g, 'XXX').replace(/{p}/g, 'PPP'),
        }
        console.info('\nmagnetX 规则如下')
        console.info(JSON.stringify(xVer, '\t', 2))
        console.info('\nmagnetW 3.x 规则如下')
        console.info(JSON.stringify(item, '\t', 2))
    }
})()
