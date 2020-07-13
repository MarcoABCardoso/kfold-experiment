const _ = require('lodash')
const { pollingAwait } = require('./utils')
const { generateReports } = require('./experiment-analysis')
const { writeFileSync } = require('fs')

const BATCH_SIZE = 10
const THROTTLE = 1000
const POLLING_INTERVAL = 10000

module.exports = class Experiment {
    constructor(options) {
        this.exportData = options.exportData
        this.trainModel = options.trainModel
        this.getModelID = options.getModelID
        this.checkModelStatus = options.checkModelStatus
        this.predict = options.predict
        this.deleteModel = options.deleteModel
    }

    async run(numFolds, verbose = false) {
        if (verbose) console.log(`[MARCAO K-FOLD] STARTING EXPERIMENT`)
        if (verbose) console.log(`[MARCAO K-FOLD] EXPORTING DATA`)
        let data = await this.exportData()
        let folds = this.partition(data, numFolds)
        if (verbose) console.log(`[MARCAO K-FOLD] TRAINING TEMPORARY MODELS`)
        let trainModels = await Promise.all(folds.map(fold => this.trainModel(fold.train)))
        let results = {}
        try {
            if (verbose) console.log(`[MARCAO K-FOLD] WAITING FOR TEMPORARY MODELS TO TRAIN`)
            await Promise.all(trainModels.map(model => this.waitUntilTrained(model, verbose)))
            if (verbose) console.log(`[MARCAO K-FOLD] ALL TEMPORARY MODELS DONE TRAINING`)
            let predictions = (await Promise.all(trainModels.map((model, i) => this.runTests(model, folds[i].test, verbose))))
                .reduce((predictions, foldPredictions) => [...predictions, ...foldPredictions], [])
            if (verbose) console.log(`[MARCAO K-FOLD] GENERATING REPORTS`)
            results = {
                predictions,
                reports: generateReports(predictions)
            }
        } catch (err) { console.log(err) }
        if (verbose) console.log(`[MARCAO K-FOLD] DELETING TEMPORARY MODELS`)
        await Promise.all(trainModels.map(model => this.deleteModel(model)))
        if (verbose) console.log(`[MARCAO K-FOLD] ALL DONE`)
        return results
    }

    /**
     * Promise that resolves when a model is done training
     * @param {object} model 
     */
    waitUntilTrained(model, verbose = false, interval = POLLING_INTERVAL) {
        if (verbose) console.log(`[MARCAO K-FOLD] [${this.getModelID(model)}] TRAINING`)
        return pollingAwait(() =>
            this.checkModelStatus(model)
                .then(done => {
                    if (verbose) console.log(`[MARCAO K-FOLD] [${this.getModelID(model)}] READY: ${done}`)
                    return done
                }),
            interval
        )
    }

    /**
     * Splits a workspace into K folds for cross-validation
     * @param {array} data 
     * @param {number} numFolds
     * @returns array of folds
     */
    partition(data, numFolds) {
        let examples = _.shuffle(data)

        let folds = examples
            .reduce((exampleGroups, example, i) => exampleGroups
                .map((f, j) => i % numFolds === j ? { train: f.train, test: f.test.concat(example) } : { train: f.train.concat(example), test: f.test }),
                Array(numFolds).fill({ train: [], test: [] })
            )

        let classGroups = folds
            .map(fold => ({
                train: _.groupBy(fold.train, 'class'),
                test: fold.test,
            }))
            .map(groupedFold => ({
                train: Object.keys(groupedFold.train).map(key => ({ class: key, examples: groupedFold.train[key] })),
                test: groupedFold.test,
            }))

        return classGroups
    }

    /**
     * Runs a set of tests against a workspace
     * @param {object} model 
     * @param {Array} tests 
     */
    async runTests(model, tests, verbose = false) {
        if (verbose) console.log(`[MARCAO K-FOLD] [${this.getModelID(model)}] STARTING TESTS`)
        let allResponses = []
        for (let i = 0; i < tests.length; i += BATCH_SIZE) {
            if (verbose) console.log(`[MARCAO K-FOLD] [${this.getModelID(model)}] STARTING BATCH ${i} - ${i + BATCH_SIZE}`)
            let batch = tests.slice(i, i + BATCH_SIZE)
            let responses = await Promise.all(
                batch.map(example => this.predict(model, example)
                    .then(r => ({
                        input: example,
                        true_class: example.class,
                        output: r
                    }))
                )
            )
            allResponses = [...allResponses, ...responses]
            if (verbose) console.log(`[MARCAO K-FOLD] [${this.getModelID(model)}] FINISHED BATCH ${i} - ${i + BATCH_SIZE}`)
            await new Promise(r => setTimeout(() => r(), THROTTLE))
        }
        return allResponses
    }

}