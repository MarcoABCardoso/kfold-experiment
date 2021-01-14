const Assistant = require('../lib')
const AssistantV1 = require('ibm-watson/assistant/v1')

let assistantOptions = {
    url: 'foo_url',
    apikey: 'foo_apikey',
    version: 'foo_version',

    THROTTLE: 1,
    POLLING_INTERVAL: 1,
    SEED: 1,
}
let sampleWorkspace = require('./sample-workspace.json')
let sampleResults = require('./sample-results.json')
let v1Mock = {
    getWorkspace: () => Promise.resolve({ result: { ...sampleWorkspace, status: 'Available' } }),
    createWorkspace: () => Promise.resolve({ result: sampleWorkspace }),
    deleteWorkspace: () => Promise.resolve({ result: {} }),
    message: (options) => Promise.resolve({ result: { context: { conversation_id: 'foo_conversation_id' }, intents: (sampleResults.predictions.find(p => p.input.text === options.input.text) || { output: [] }).output.map(o => ({ intent: o.class, confidence: o.confidence })) } })
}

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

describe('Assistant', () => {
    describe('#constructor', () => {
        let assistant = new Assistant(assistantOptions)
        it('Creates an instance of Assistant', () => {
            expect(assistant).toBeInstanceOf(Assistant)
        })
        it('Sets v1 to an instance of the Watson Assistant V1 SDK with the given parameters', () => {
            expect(assistant.v1).toBeInstanceOf(AssistantV1)
            expect(assistant.v1.baseOptions.url).toBe('foo_url')
            expect(assistant.v1.baseOptions.version).toBe('foo_version')
            expect(assistant.v1.authenticator.apikey).toBe('foo_apikey')
        })
    })

    describe('#runExperiment', () => {
        let assistant = new Assistant(assistantOptions)
        it('Executes K-fold experiment on a workspace', (done) => {
            assistant.v1 = v1Mock
            assistant.runExperiment({ workspace_id: 'foo_workspace_id' })
                .catch(err => done.fail(err))
                .then(results => {
                    expect(compareResults(results, sampleResults)).toBe(true)
                    done()
                })
        })
    })

})