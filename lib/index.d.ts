
/**
 * @module marcao-kfold
 */

declare class Experiment {
    /**
     * Construct an Experiment object.
     * @constructor
     */
    constructor(options: ExperimentOptions)
    /**
     * Execute experiment
     */
    run(): Promise<ExperimentResults>
}

interface ExperimentOptions {
    exportData: () => Promise<Example[]>
    trainModel: (trainSet: Example[]) => Promise<Model>
    checkModelStatus: (model: Model) => Promise<boolean>
    predict: (input: any) => Promise<Class[]>
    deleteModel: (model: Model) => Promise<any>

    NUM_FOLDS?: Number
    VERBOSE?: Number
    SEED?: Number
    BATCH_SIZE?: Number
    THROTTLE?: Number
    POLLING_INTERVAL?: Number
}

interface Example {
    input: any
    class: string
}
interface Class {
    class: string
    confidence: number
}
interface Model {
    id: string
}

interface ExperimentResults {
    predictions: {
        input: any
        true_class: string
        output: Class[]
    }[]
    reports: {
        class_distribution: {
            class: string
            count: number
        }[]
        precision_at_k: {
            k: number,
            precision: number
        }[]
        class_accuracy: {
            class: string
            count: number
            k: number
            precision: number
        }[]
        pairwise_class_errors: {
            true_class: string
            predicted_class: string
            count: number
            avg_confidence: number
            errors: {
                predicted_class: string
                confidence: number
                input: any
            }[]
        }[]
        accuracy_vs_coverage: {
            confidence_threshold: number
            accuracy: number
            coverage: number
        }[]
    }
}

export = Experiment