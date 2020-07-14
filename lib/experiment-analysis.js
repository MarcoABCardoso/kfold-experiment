const groupBy = require("group-by")

function classDistribution(predictions) {
    let classHash = groupBy(predictions, 'true_class')
    return Object.keys(classHash)
        .map(className => ({ class: className, count: classHash[className].length }))
        .sort((a, b) => a.count - b.count)
}

function precisionAtK(predictions, maxK = 10) {
    return Array(maxK).fill().map((_, i) => i)
        .map(k => predictions.map(r => r.output.map(i => i.class).slice(0, k + 1).includes(r.true_class)))
        .map((hits, k) => ({ k: k, precision: mean(hits) }))
}

function classAccuracy(predictions) {
    let classHash = groupBy(predictions, 'true_class')
    return Object.keys(classHash).map(className => ({
        class: className,
        count: classHash[className].length,
        ...precisionAtK(classHash[className], 1)[0]
    }))
        .sort((a, b) => a.count - b.count)
}

function pairwiseClassErrors(predictions) {
    let classHash = groupBy(predictions, 'true_class')
    return Object.keys(classHash)
        .map(key => ({
            true_class: key,
            errors: groupBy(
                classHash[key]
                    .map(prediction => prediction.output[0] ? {
                        predicted_class: prediction.output[0].class,
                        confidence: prediction.output[0].confidence,
                        input: prediction.input
                    } : { predicted_class: null, confidence: 0, input: prediction.input })
                , 'predicted_class')
        }))
        .reduce((pwce, item) => [
            ...pwce,
            ...Object.keys(item.errors)
                .filter(key => key !== item.true_class)
                .map(key => ({
                    true_class: item.true_class,
                    predicted_class: key,
                    count: item.errors[key].length,
                    avg_confidence: mean(item.errors[key].map(p => p.confidence)),
                    errors: item.errors[key]
                }))
        ], [])
        .sort((a, b) => b.count + b.avg_confidence - a.count - a.avg_confidence)
}

function accuracyVsCoverage(predictions, step = 0.1) {
    return Array(1 / step).fill().map((_, i) => i * step)
        .map(confidence_threshold => {
            let highConfidenceErrors = predictions
                .filter(prediction => !prediction.output[0] || (prediction.output[0].class !== prediction.true_class && prediction.output[0].confidence >= confidence_threshold))
            let unansweredQuestions = predictions
                .filter(prediction => !prediction.output[0] || (prediction.output[0].confidence < confidence_threshold))
            return {
                confidence_threshold,
                accuracy: 1 - highConfidenceErrors.length / predictions.length,
                coverage: 1 - unansweredQuestions.length / predictions.length
            }
        })
}

function generateReports(predictions) {
    return {
        class_distribution: classDistribution(predictions),
        precision_at_k: precisionAtK(predictions),
        class_accuracy: classAccuracy(predictions),
        pairwise_class_errors: pairwiseClassErrors(predictions),
        accuracy_vs_coverage: accuracyVsCoverage(predictions),
    }
}

function mean(array) {
    return array.reduce((result, el) => result + el, 0) / array.length
}

module.exports = {
    classDistribution,
    precisionAtK,
    classAccuracy,
    pairwiseClassErrors,
    accuracyVsCoverage,
    generateReports
}