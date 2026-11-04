const WK = require('./kernels.js'); require('./bench.js').run(WK).then(r => require('fs').writeFileSync(process.argv[2] || '/dev/null', JSON.stringify(r, null, 1)));
