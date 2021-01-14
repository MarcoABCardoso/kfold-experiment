const { shuffle } = require('shuffle-seed')
const Experiment = require('../lib')

let sampleData = require('./sample-data.json')
let sampleResults = require('./sample-results.json')
let sampleFolds = require('./sample-folds.json')
let experimentOptions

function compareResults(r1, r2) {
    for (let p1 of r1.predictions)
        if (!r2.predictions.find(p2 => JSON.stringify(p2) === JSON.stringify(p1))) return false
    for (let report in r1.reports)
        for (let row1 of r1.reports[report])
            if (report === 'pairwise_class_errors') {
                let row2 = r2.reports[report].find(row2 => JSON.stringify({ ...row1, errors: undefined }) === JSON.stringify({ ...row2, errors: undefined }))
                if (!row2) return false
                for (let e1 of row1.errors)
                    if (!row2.errors.find(e2 => JSON.stringify(e1) === JSON.stringify(e2))) return false
            }
            else if (!r2.reports[report].find(row2 => JSON.stringify(row1) === JSON.stringify(row2))) return false
    return true
}

beforeEach(() => {
    experimentOptions = {
        exportData: jest.fn().mockResolvedValue(sampleData),
        trainModel: jest.fn().mockResolvedValue({ id: Math.random() }),
        getModelID: model => model.id,
        checkModelStatus: jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true),
        predict: jest.fn(example => Promise.resolve(shuffle([{ class: 'class_2', confidence: 0.5 }, { class: 'class_1', confidence: 0.6 }, { class: 'class_0', confidence: 0.7 }], JSON.stringify(example.input)))).mockResolvedValueOnce([]),
        deleteModel: jest.fn().mockResolvedValue('foo_delete_response'),

        THROTTLE: 0,
        POLLING_INTERVAL: 0,
        SEED: 1,
        NUM_FOLDS: 3,
        BATCH_SIZE: 2
    }
})

describe('Experiment', () => {
    describe('#constructor', () => {
        it('Creates an instance of Experiment', () => {
            let experiment = new Experiment(experimentOptions)
            expect(experiment).toBeInstanceOf(Experiment)
        })
        it('Sets this.log when verbose is enabled', () => {
            let experiment = new Experiment({ ...experimentOptions, VERBOSE: true })
            expect(experiment.log).toEqual(console.log)
        })
    })

    describe('#runExperiment', () => {
        it('Executes K-fold experiment on a workspace', (done) => {
            let experiment = new Experiment(experimentOptions)
            experiment.run()
                .then(results => {
                    expect(compareResults(results, sampleResults)).toBe(true)
                    expect(experiment.trainModel).toHaveBeenCalledTimes(3)
                    expect(experiment.deleteModel).toHaveBeenCalledTimes(3)
                    done()
                })
                .catch(err => done.fail(err))
        })
        it('Deletes models if prediction fails', (done) => {
            let experiment = new Experiment(experimentOptions)
            experiment.predict = jest.fn().mockRejectedValue()
            experiment.run()
                .then(results => {
                    expect(results).toEqual({})
                    expect(experiment.trainModel).toHaveBeenCalledTimes(3)
                    expect(experiment.deleteModel).toHaveBeenCalledTimes(3)
                    done()
                })
                .catch(err => done.fail(err))
        })
        it('Exits prematurely if trainOnly is enabled', (done) => {
            experimentOptions.trainOnly = true
            let experiment = new Experiment(experimentOptions)
            experiment.run()
                .then(() => {
                    expect(experiment.deleteModel).not.toHaveBeenCalled()
                    expect(experiment.predict).not.toHaveBeenCalled()
                    done()
                })
                .catch(err => done.fail(err))
        })
        it('Uses folds if passed', (done) => {
            experimentOptions = { ...experimentOptions, ...sampleFolds }
            let experiment = new Experiment(experimentOptions)
            experiment.run()
                .then(results => {
                    expect(compareResults(results, sampleResults)).toBe(true)
                    expect(experiment.trainModel).not.toHaveBeenCalled()
                    expect(experiment.deleteModel).toHaveBeenCalledTimes(3)
                    done()
                })
                .catch(err => done.fail(err))
        })
    })
})