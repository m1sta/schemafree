(async () => {

    try {

        //Connect to the embedded database. Options can be passed.
        let db = await require('./index.js')()
        console.log("\nData Connection Established Successfully\n")
        console.table = (o) => console.log(db.format(o))

        //Data stored without schema defintion. Id is generated automatically if not provided.
        let rebecca = await db.set({ type: "person", name: "Rebecca", phone: "1234 567 890" })
        let jonathon = await db.set({ type: "person", name: "Jonathon", phone: "555 055 5556" })
        let josephine = await db.set({ type: "person", name: "Josephine" })

        //Links are specified in a bi-direction fashion. Predicate argument names are used to identify target entity types.
        await db.link(jonathon, rebecca, "husband", "wife")
        await db.link(rebecca, person => person.name == "Josephine", "friends")

        //The resulting dataset can be walked as a graph. Only a very simple set of graph traversal commands are currently available.
        let walkResult = await db.walk(josephine).all("friends").all("husband").execute()
        console.table(walkResult.result)

        //The resulting dataset can be queried using sql. Entity types become table names. Table names must be prefixed with $. All links are stored in a single table.
        let joinResult = await db.query(`
            select p1.name as [From], p2.name as [To]
            from $person p1, $person p2, $links link
            where link.a = p1.id
            and   link.b = p2.id
            and   (link.label = "husband" or link.label = "wife")
        `).execute()
        console.table(joinResult)

        //The opposite of link() is unlink(). The opposite of set() is unset(). These are used to remove data from the database.
        let simpleResult = await db.query("select * from $person").execute()
        await db.unlink(rebecca, "friend") //Not implemented
        await db.unset(simpleResult)

        console.log("Script Completed")

    }
    catch (e) {
        console.log("An error occurred.", e)
    }
})()