const { shuffle } = require("shuffle-seed")
const { Experiment } = require("../lib")

let sampleData = require('./sample-data.json')
let sampleResults = require('./sample-results.json')
let experimentOptions


beforeEach(() => {
    experimentOptions = {
        exportData: jest.fn().mockResolvedValue(sampleData),
        trainModel: jest.fn().mockResolvedValue({ id: Math.random() }),
        getModelID: model => model.id,
        checkModelStatus: jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true),
        predict: jest.fn(example => Promise.resolve(shuffle([{ class: "class_2", confidence: 0.5 }, { class: "class_1", confidence: 0.6 }, { class: "class_0", confidence: 0.7 }], JSON.stringify(example.input)))).mockResolvedValueOnce([]),
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
                .catch(err => done.fail(err))
                .then(results => {
                    expect(results).toEqual(sampleResults)
                    expect(experiment.trainModel).toHaveBeenCalledTimes(3)
                    expect(experiment.deleteModel).toHaveBeenCalledTimes(3)
                    done()
                })
        })
        it('Deletes models if prediction fails', (done) => {
            let experiment = new Experiment(experimentOptions)
            experiment.predict = jest.fn().mockRejectedValue()
            experiment.run()
                .catch(err => done.fail(err))
                .then(results => {
                    expect(results).toEqual({})
                    expect(experiment.trainModel).toHaveBeenCalledTimes(3)
                    expect(experiment.deleteModel).toHaveBeenCalledTimes(3)
                    done()
                })
        })
    })
})