module.exports = (db, start) => {

    let api = {
        db: db,
        steps: [start],
        all: key => api.steps.add({ 'type': 'all', key: key }),
        group: predicate => api.steps.add({ type: 'group', predicate: predicate }),
        map: predicate => api.steps.add({ type: 'map', predicate: predicate }),
        filter: predicate => api.steps.add({ type: 'filter', predicate: predicate }),
        label: (label, predicate) => api.steps.add({ type: 'label', predicate: predicate, label: label }),
        loop: (label, predicate) => api.steps.add({ type: 'loop', predicate: predicate, label: label })
    }

    api.steps.add = data => {
        api.steps.push(data)
        return api
    }

    api.execute = async () => {
        let start = api.steps.shift()
        if (start.apply) start = db[require('./args')(start)].filter(start) //start must be a predicate or an entity object
        if(!start.splice) start = [start]

        let stepIndex = 0
        let context = { comments: "Not fully implemented", result: start }
        while (stepIndex < api.steps.length) {
            let step = api.steps[stepIndex]

            if (step.type == 'all') {
                let newResult = []
                context.result.forEach(item => {
                    if(item[step.key]) newResult = newResult.concat(Object.values(item[step.key]))
                })
                context.result = newResult
                stepIndex++

            } else {
                context.result.push(api.steps[stepIndex])
                stepIndex++
            }
        }
        return context
    }

    return api

}