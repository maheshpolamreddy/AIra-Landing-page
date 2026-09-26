import { buildMixedSession, hasCleanDiagram, loadPyqBank, isBankEligible } from '../lib/pyq/bank.ts'

const bank = loadPyqBank().filter(isBankEligible)
const withD = bank.filter(hasCleanDiagram).length
const client = buildMixedSession({
  count: 10,
  years: [2014, 2017],
  seed: 'ui-mix-1',
})
const d = client.studentQuestions.filter((q) => hasCleanDiagram(q as never)).length
console.log(
  JSON.stringify(
    {
      bankEligible: bank.length,
      bankWithDiagram: withD,
      sessionDiagrams: d,
      diagramQuestionCount: (client as { diagramQuestionCount?: number }).diagramQuestionCount,
      years: client.yearsUsed,
      firstId: client.studentQuestions[0]?.id,
      firstText: String(client.studentQuestions[0]?.content?.text || '').slice(0, 100),
      hasAnswerLeak: JSON.stringify(client).includes('"answer":'),
    },
    null,
    2,
  ),
)
