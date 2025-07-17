// flow/trace.js
export default {
  updated: new Date().toISOString(),
  steps: [
    { id: 'start', label: 'Start', next: 'loadData' },
    { id: 'loadData', label: 'Load Data', next: 'process' },
    { id: 'process', label: 'Process', next: 'done' },
    { id: 'done', label: 'Done', next: null }
  ]
};
