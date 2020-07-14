<h1 align="center">marcao-kfold</h1>
<p>
  <a href="https://www.npmjs.com/package/marcao-wa-experiment" target="_blank">
    <img alt="Version" src="https://img.shields.io/npm/v/marcao-kfold.svg">
  </a>
  <a href="#" target="_blank">
    <img alt="License: ISC" src="https://img.shields.io/badge/License-ISC-yellow.svg" />
  </a>
</p>

> Base package for implementing K-Fold experiments

## Install

```sh
npm install marcao-kfold
```

## Usage

```js
const Experiment = require('marcao-kfold')

const experiment = new Experiment({
    exportData: () => [],               // Function that gets data, as an array of { input: any, class: string }
    trainModel: (train) => {},          // Function that creates a new model, using an array of { input: any, class: string }
    checkModelStatus: (model) => true,  // Function that checks model status, resolves true when ready
    predict: (model, input) => [],      // Function that sends input to a model, resolves array of { class: string, confidence: number }
    deleteModel: (model) => {},         // Function that deletes temporary model once done with testing
})
let results = await experiment.run()
```

## Run tests

```sh
npm run test
```

## Author

👤 **Marco Cardoso**

* Github: [@MarcoABCardoso](https://github.com/MarcoABCardoso)
* LinkedIn: [@marco-cardoso](https://linkedin.com/in/marco-cardoso)

## Show your support

Give a ⭐️ if this project helped you!