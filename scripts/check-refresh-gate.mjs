#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { evaluateRefreshGate } from '../dist/lib/data-quality.js'

const root = process.cwd()
const currentPath = process.argv[2] ?? join(root, 'public', 'graph', 'data-quality.json')
const previousPath = process.argv[3] ?? join(root, '.internal', 'last-data-quality.json')
const reportPath = process.argv[4] ?? join(root, '.internal', 'refresh-gate-report.json')

if (!existsSync(currentPath)) {
  console.error(`refresh-gate: current report not found: ${currentPath}`)
  process.exit(2)
}

const current = readJson(currentPath)
if (!existsSync(previousPath)) {
  writeJson(reportPath, { status: 'ok', reasons: [], note: 'no previous data-quality report; baseline only', current: summary(current) })
  console.log(`refresh-gate: no previous report, wrote baseline report to ${reportPath}`)
  process.exit(0)
}

const previous = readJson(previousPath)
const gate = evaluateRefreshGate(previous, current)
writeJson(reportPath, { ...gate, previous: summary(previous), current: summary(current) })
if (gate.status === 'block_deploy') {
  console.error(`refresh-gate: block_deploy; wrote ${reportPath}`)
  for (const reason of gate.reasons) console.error(`- ${reason}`)
  process.exit(1)
}
console.log(`refresh-gate: ok; wrote ${reportPath}`)

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function summary(report) {
  return {
    generatedAt: report.generatedAt,
    coverage: {
      totalSourceModels: report.coverage?.totalSourceModels,
      withAnyPricing: report.coverage?.withAnyPricing,
      withReleaseDate: report.coverage?.withReleaseDate,
      withContextWindow: report.coverage?.withContextWindow,
    },
    observations: report.observations,
  }
}
