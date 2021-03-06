module.exports = (opts) => new Promise((resolve, reject) => {

    let api = { cache: { links: [] }, index: {}, status: "Loading" }
    let level = require('level')(opts && opts.path || './schema.db', opts || { valueEncoding: 'json' })
    let db = require('then-levelup')(level)
    let alasql = require('alasql')
    let shortid = require('shortid');
    let walk = require('./walk.js')
    let args = require('./args.js')

    let setCache = (data) => {
        if (!api.cache[data.type]) api.cache[data.type] = []
        if (!api.index[data.type]) api.index[data.type] = {}

        let index = api.index[data.type][data.id]
        if (!index) index = api.cache[data.type].length
        return api.cache[data.type][index] = data
    }

    api.search = async (predicate) => {
        let type = args(predicate)[0]
        return api.cache[type].filter(predicate)
    }

    api.set = async (data) => {
        let collection = data.splice ? data : [data]
        if (collection.filter(i => !i.type).length > 0) throw "All items must have a 'type' property"
        await Promise.all(collection.map(async item => {
            if (!item.id) item.id = await api.uid(item.type) //if no row id is provided then one will be generated. 
            await db.put(item.type + ":" + item.id, item)
            return setCache(item)
        }))
        return data
    }

    api.unset = (list) => new Promise((resolve, reject) => {
        let ops = list.map(item => ({ type: "del", key: item.type + ":" + item.id }))
        let cacheOps = list.map(item => api.cache[item.type].splice(api.index[item.type][item.id]))
        db.batch(ops, err => {
            !err ? resolve() : reject(err)
        })
    })

    api.link = async (toObj, fromObj, fromLabel, toLabel) => {
        //note: toObj and fromObj are internally managed as lists so that in the future multiple links can be created/destroyed with a single predicate
        if (fromObj.apply) fromObj = await api.search(fromObj)
        if (toObj.apply) toObj = await api.search(toObj)
        if (!fromObj.splice) fromObj = [fromObj]
        if (!toObj.splice) toObj = [toObj]
        if (!toLabel) toLabel = fromLabel

        //create links between cached table row objects for use in graph query
        fromObj.forEach(f => { if (!f[fromLabel]) f[fromLabel] = {}; f[fromLabel][toObj[0].id] = toObj[0]; })
        toObj.forEach(t => { if (!t[toLabel]) t[toLabel] = {}; t[toLabel][fromObj[0].id] = fromObj[0]; })

        //todo: support addition of multiple links at once

        //update the cached link tables to allow links to be queried via sql
        let cachedFromLink = { a: fromObj[0].id, b: toObj[0].id, label: fromLabel }
        let cachedToLink = { a: toObj[0].id, b: fromObj[0].id, label: toLabel }
        if (!api.cache.links.find(i => JSON.stringify(i) == JSON.stringify(cachedFromLink))) api.cache.links.push(cachedFromLink)
        if (!api.cache.links.find(i => JSON.stringify(i) == JSON.stringify(cachedToLink))) api.cache.links.push(cachedToLink)

        //store the link in the database
        let key = "~" + [fromObj[0].type, fromObj[0].id, fromLabel, toObj[0].type, toObj[0].id, toLabel].join(":")
        await db.put(key, {})

        return fromObj.concat(toObj)
    }

    api.unlink = async (toObj, fromObj, fromLabel, toLabel) => {
        //note: toObj and fromObj are internally managed as lists so that in the future multiple links can be created/destroyed with a single predicate
        if (fromObj.apply) fromObj = await api.search(fromObj)
        if (toObj.apply) toObj = await api.search(toObj)
        if (!fromObj.splice) fromObj = [fromObj]
        if (!toObj.splice) toObj = [toObj]
        if (!toLabel) toLabel = fromLabel

        //create links between cached table row objects for use in graph query
        fromObj.forEach(f => { 
            delete f[fromLabel][toObj[0].id] 
        })
        toObj.forEach(t => { delete t[toLabel][fromObj[0].id] })

        //todo: support removal of multiple links at once

        //update the cached link tables to allow links to be queried via sql
        let cachedFromLink = { a: fromObj[0].id, b: toObj[0].id, label: fromLabel }
        let cachedToLink = { a: toObj[0].id, b: fromObj[0].id, label: toLabel }
        api.cache.links = api.cache.links.filter(i => 
            JSON.stringify(i) != JSON.stringify(cachedFromLink) && JSON.stringify(i) != JSON.stringify(cachedToLink)
        )

        //remove the link in the database
        let key = "~" + [fromObj[0].type, fromObj[0].id, fromLabel, toObj[0].type, toObj[0].id, toLabel].join(":")
        await db.del(key, {})

        return fromObj.concat(toObj)
    }

    api.uid = async () => {
        return shortid.generate()
    }

    api.query = (sql, preventLinkExpansion) => {

        let linkSyntaxExpander = t1 => {
            /*
                Example Input:
                    select p1.name as husband, p2.name as wife, address.suburb
                    from person p1, person p2, addresses
                    link p1.wife to p2 with outer join and p2.address to addresses with inner
                    where p1.age > 30
                    group by address.suburb

                Note:
                    inner and outer join concepts not currently implemented
            */
            let rxLink = /(\s+link\s+)([a-zA-Z0-9_\-\.]+\s+to[a-zA-Z0-9_\-\.,+\s]+)(where|group by|having|$)/gi
            let rxTo = /([^\s]+)\.([^\s]+)\s+to\s+([^\s]+)/gi

            let t2 = t1.replace(rxLink, (link, head, body, tail) => {
                let linksFrom = []
                let linksWhere = []

                let oldBodyParts = body.split(',')
                for (part of oldBodyParts) {
                    part.replace(rxTo, (stmt, fromTable, fromColumn, toTable) => {
                        let linkTable = 'links' + linksFrom.length
                        linksFrom.push(`$links ${linkTable}`)
                        linksWhere.push(`${linkTable}.a = ${fromTable}.id and ${linkTable}.b = ${toTable}.id and ${linkTable}.label = '${fromColumn}'`)
                    })
                }
                return ', ' + linksFrom.join(', ') + '\n where ' + linksWhere.join('\nand ') + '\n' + (/where/.test(tail) ? ' and ' : tail)
            })
            return t2;
        }

        let expandedSql = preventLinkExpansion ? sql : linkSyntaxExpander(sql)
        return { execute: async () => alasql(expandedSql, api.cache) } //api styled this way to support complied queries in the future and for consistency with .walk()
    }

    api.walk = (start) => walk(api.cache, start)

    api.format = require('./table')

    //load data from database
    db.createReadStream()
        .on('data', function (data) {
            if (data.key[0] != "~") {
                setCache(data.value)
            }
            else {
                //Links are marked in the datastore by the ~ prefix. This prefix allows means they will be read after all other data items.
                try {
                    [fromType, fromId, fromLabel, toType, toId, toLabel] = data.key.slice(1).split(":")
                    let fromIndex = api.index[fromType][fromId]
                    let fromObject = api.cache[fromType][fromIndex]
                    let toIndex = api.index[toType][toId]
                    let toObject = api.cache[toType][toIndex]

                    if (!fromObject[fromLabel]) fromObject[fromLabel] = []
                    if (!toObject[toLabel]) toObject[toLabel] = []
                    fromObject[fromLabel].push(toObject)
                    toObject[toLabel].push(fromObject)

                    let cachedFromLink = { a: fromIndex, b: toIndex, label: fromLabel }
                    let cachedToLink = { a: toIndex, b: fromIndex, label: toLabel }
                    if (!api.cache.links.find(i => JSON.stringify(i) == JSON.stringify(cachedFromLink))) api.cache.links.push(cachedFromLink)
                    if (!api.cache.links.find(i => JSON.stringify(i) == JSON.stringify(cachedToLink))) api.cache.links.push(cachedToLink)

                } catch (e) {
                    db.del(data.key)
                    //todo: enable the line below with a flag. Wait until unlink() is actually implemented.
                    //console.log("An invalid link has been identified and cleaned up. Please unlink entities before removing them.")
                }
            }
        })
        .on('error', function (err) {
            reject(err)
        })
        .on('close', function () {

        })
        .on('end', function () {
            api.status = "Loaded"
            resolve(api)
        })
})