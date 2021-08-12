const { shuffle } = require('shuffle-seed')
const { pollingAwait } = require('./utils')
const { generateReports } = require('./experiment-analysis')

class Experiment {
    constructor(options) {
        this.exportData = options.exportData
        this.trainModel = options.trainModel
        this.checkModelStatus = options.checkModelStatus
        this.predict = options.predict
        this.deleteModel = options.deleteModel

        this.config = {
            ...Experiment.getDefaultConfig(),
            ...options
        }

        this.log = this.config.verbose ? console.log : () => { }
    }

    async run() {
        this.log('[K-FOLD] STARTING EXPERIMENT')
        this.log('[K-FOLD] EXPORTING DATA')
        let folds, trainModels
        if (!this.config.folds || !this.config.trainModels) {
            let data = await this.exportData()
            folds = this.partition(data)
            this.log('[K-FOLD] TRAINING TEMPORARY MODELS')
            trainModels = await Promise.all(folds.map(fold => this.trainModel(fold.train)))
        } else {
            this.log('[K-FOLD] TEMPORARY MODELS ALREADY CREATED')
            folds = this.config.folds
            trainModels = this.config.trainModels
        }
        let results = {}
        try {
            this.log('[K-FOLD] WAITING FOR TEMPORARY MODELS TO TRAIN')
            await Promise.all(trainModels.map(model => this.waitUntilTrained(model)))
            this.log('[K-FOLD] ALL TEMPORARY MODELS DONE TRAINING')
            if (this.config.trainOnly) throw new Error('[K-FOLD] TRAIN ONLY RUN')
            let predictions = (await Promise.all(trainModels.map((model, i) => this.runTests(model, folds[i].test))))
                .reduce((predictions, foldPredictions) => [...predictions, ...foldPredictions], [])
            this.log('[K-FOLD] GENERATING REPORTS')
            results = {
                predictions: predictions.sort((p1, p2) => JSON.stringify(p1) > JSON.stringify(p2)),
                reports: generateReports(predictions)
            }
        } catch (err) {
            this.log(err)
        }
        if (this.config.trainOnly) return { folds: folds.map(fold => ({ train: fold.train })), trainModels }
        this.log('[K-FOLD] DELETING TEMPORARY MODELS')
        await Promise.all(trainModels.map(model => this.deleteModel(model))).catch(err => { this.log(err) })
        this.log('[K-FOLD] ALL DONE')
        return results
    }

    /**
     * Promise that resolves when a model is done training
     * @param {object} model 
     */
    waitUntilTrained(model) {
        this.log(`[K-FOLD] [${model.id}] TRAINING`)
        return pollingAwait(async () => {
            let done = await this.checkModelStatus(model)
            this.log(`[K-FOLD] [${model.id}] READY: ${done}`)
            return done
        },
        this.config.polling_interval,
        this.config.polling_timeout,
        )
    }

    /**
     * Splits a workspace into K folds for cross-validation
     * @param {array} data 
     * @returns array of folds
     */
    partition(data) {
        return shuffle(data, this.config.seed)
            .reduce((exampleGroups, example, i) => exampleGroups
                .map((f, j) => i % this.config.num_folds === j ? { train: f.train, test: f.test.concat(example) } : { train: f.train.concat(example), test: f.test }),
            Array(this.config.num_folds).fill({ train: [], test: [] })
            )
    }

    /**
     * Runs a set of tests against a workspace
     * @param {object} model 
     * @param {Array} tests 
     */
    async runTests(model, tests) {
        this.log(`[K-FOLD] [${model.id}] STARTING TESTS`)
        let allResponses = []
        for (let i = 0; i < tests.length; i += this.config.batch_size) {
            this.log(`[K-FOLD] [${model.id}] STARTING BATCH ${i} - ${i + this.config.batch_size}`)
            let batch = tests.slice(i, i + this.config.batch_size)
            let responses = await Promise.all(
                batch.map(async example => {
                    let result = await this.predict(model, example.input)
                    return {
                        input: example.input,
                        true_class: example.class,
                        output: result
                    }
                })
            )
            allResponses = [...allResponses, ...responses]
            this.log(`[K-FOLD] [${model.id}] FINISHED BATCH ${i} - ${i + this.config.batch_size}`)
            await new Promise(r => setTimeout(() => r(), this.config.throttle))
        }
        return allResponses
    }
}

Experiment.getDefaultConfig = () => ({
    verbose: false,
    num_folds: 3,
    batch_size: 10,
    throttle: 1000,
    polling_interval: 10000,
    polling_timeout: 600000,
    seed: Math.random(),
})

module.exports = Experiment