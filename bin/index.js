#!/usr/bin/env node

const commandLineArgs = require('command-line-args')
const commandLineUsage = require('command-line-usage')
const AssistantV1 = require('ibm-watson/assistant/v1')
const { IamAuthenticator } = require('ibm-watson/auth')
const { Experiment } = require('../lib')
const fs = require('fs')

let args = [
    { name: 'help', alias: 'h', type: Boolean, defaultValue: false, description: 'Print usage instructions.' },
    { name: 'apikey', alias: 'a', type: String, description: 'Watson Assistant API Key.' },
    { name: 'workspace_id', alias: 'w', type: String, description: 'Watson Assistant workspace ID.' },
    { name: 'url', alias: 'u', type: String, description: 'Watson Assistant base URL.' },
    { name: 'num_folds', alias: 'n', type: Number, defaultValue: 3, description: 'Number of folds. Default: 3' },
    { name: 'version', alias: 'v', type: String, defaultValue: '2020-07-01', description: 'Watson Assistant API version. Default: 2020-07-01' },
    { name: 'output', alias: 'o', type: String, defaultValue: 'results.json', description: 'Output file. Default: results.json' },
]
const sections = [
    { header: 'Marcão Experiment Script', content: 'Runs K-Fold cross validation on Watson Assistant Skill.' },
    { header: 'Options', optionList: args },
    { header: 'Output', content: 'Experiment results in JSON format' },
]
const options = commandLineArgs(args)

if (options.help || (
    !options.apikey ||
    !options.workspace_id ||
    !options.url
))
    return console.log(commandLineUsage(sections))


async function main() {
    let assistant = new AssistantV1({
        url: options.url,
        authenticator: new IamAuthenticator({ apikey: options.apikey }),
        version: '2017-07-01'
    })
    const experiment = new Experiment({
        exportData: () => assistant.getWorkspace({ workspaceId: options.workspace_id, _export: true })
            .then(data => data.result.intents
                .reduce((examples, intent) => [
                    ...examples,
                    ...intent.examples.map(e => ({ text: e.text, class: intent.intent }))], [])),
        trainModel: (train) => assistant.createWorkspace({ name: 'Experiment Workspace', intents: train.map(c => ({ intent: c.class, examples: c.examples })) }).then(data => data.result),
        getModelID: (model) => model.workspace_id,
        checkModelStatus: (model) => assistant.getWorkspace({ workspaceId: model.workspace_id }).then(data => data.result.status === 'Available'),
        predict: (model, example) => assistant.message({ workspaceId: model.workspace_id, input: example, alternateIntents: true }).then(data => data.result.intents.map(intent => ({ class: intent.intent, confidence: intent.confidence }))),
        deleteModel: (model) => assistant.deleteWorkspace({ workspaceId: model.workspace_id }),
    })
    let results = await experiment.run(options.num_folds, true)
    fs.writeFileSync(options.output, JSON.stringify(results, null, 4))
}


main()