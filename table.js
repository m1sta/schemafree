var Table = require('easy-table')

module.exports = (arr) => {
    var t = new Table()
    arr.forEach(function (record) {
        if (typeof record === 'string' || typeof record === 'number') {
            t.cell('item', record)
        } else {
            Object.keys(record).forEach(function (property) {
                var cellValue = record[property].splice ? "[Array: " + record[property].length + "]" : record[property]
                t.cell(property, cellValue)
            })
        }
        t.newRow()
    })
    return t.toString()
}
