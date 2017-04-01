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
        if (!start.splice) start = [start]

        let stepIndex = 0
        let context = { values: { result: start }, labels: {} }

        while (stepIndex < api.steps.length) {
            let step = api.steps[stepIndex]

            if (step.type == 'all') {
                let newResult = []
                context.values.result.forEach(item => {
                    if (item[step.key]) newResult = newResult.concat(Object.values(item[step.key]))
                })
                context.values.result = newResult
                stepIndex++

            } else if (step.type == 'group') {
                let newResult = {}
                Promise.all(context.values.result.forEach(async item => {
                    let groupName = await step.predicate(item)
                    if (!newResult[groupName]) newResult[groupName] = []
                    newResult[groupName].push(item)
                }))
                context.values.result = newResult
                stepIndex++

            } else if (step.type == 'map') {
                context.values.result = await Promise.all(context.values.result.map(async item => await step.predicate(item)))
                stepIndex++

            } else if (step.type == 'filter') {
                context.values.result = await Promise.all(context.values.result.filter(async item => await step.predicate(item)))
                stepIndex++

            } else if (step.type == 'label') {
                context.labels[step.label] = stepIndex
                context.values[step.label] = context.values.result
                await step.predicate(context)
                stepIndex++

            } else if (step.type == 'loop') {
                stepIndex = await step.predicate(context) ? context.labels[step.label] : stepIndex + 1

            } else {
                console.log("An invalid traversal step type was found.")
                stepIndex++
            }
        }
        
        return context.values
    }
    return api
}