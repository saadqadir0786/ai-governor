/**
 * Pure zero-dependency terminal formatter and styler
 */

const isColorSupported = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.FORCE_COLOR);

export const c = {
  reset: isColorSupported ? '\x1b[0m' : '',
  bold: isColorSupported ? '\x1b[1m' : '',
  dim: isColorSupported ? '\x1b[2m' : '',
  italic: isColorSupported ? '\x1b[3m' : '',
  underline: isColorSupported ? '\x1b[4m' : '',
  
  red: isColorSupported ? '\x1b[31m' : '',
  green: isColorSupported ? '\x1b[32m' : '',
  yellow: isColorSupported ? '\x1b[33m' : '',
  blue: isColorSupported ? '\x1b[34m' : '',
  magenta: isColorSupported ? '\x1b[35m' : '',
  cyan: isColorSupported ? '\x1b[36m' : '',
  white: isColorSupported ? '\x1b[37m' : '',
  gray: isColorSupported ? '\x1b[90m' : '',
  
  bgBlue: isColorSupported ? '\x1b[44m' : '',
  bgMagenta: isColorSupported ? '\x1b[45m' : '',
  bgCyan: isColorSupported ? '\x1b[46m' : '',
};

export function banner() {
  console.log(`
${c.cyan}${c.bold}================================================================${c.reset}
${c.magenta}${c.bold}                    🛡️  A I - G O V E R N O R                   ${c.reset}
${c.dim}        Model-Agnostic AI Governance & RBAC Policy Engine       ${c.reset}
${c.cyan}${c.bold}================================================================${c.reset}
`);
}

export function logSuccess(msg) {
  console.log(`${c.green}✔ ${c.bold}${msg}${c.reset}`);
}

export function logInfo(msg) {
  console.log(`${c.cyan}ℹ ${msg}${c.reset}`);
}

export function logWarn(msg) {
  console.log(`${c.yellow}⚠ ${c.bold}${msg}${c.reset}`);
}

export function logError(msg) {
  console.log(`${c.red}✖ ${c.bold}${msg}${c.reset}`);
}

export function table(headers, rows) {
  const colWidths = headers.map((h, i) => {
    const maxRow = Math.max(...rows.map(r => (r[i] ? String(r[i]).length : 0)));
    return Math.max(h.length, maxRow) + 2;
  });

  const separator = '+' + colWidths.map(w => '-'.repeat(w)).join('+') + '+';
  const formatRow = (cols, isBold = false) => {
    return '|' + cols.map((col, i) => {
      const text = String(col || '');
      const padded = ' ' + text + ' '.repeat(colWidths[i] - text.length - 1);
      return isBold ? `${c.bold}${padded}${c.reset}` : padded;
    }).join('|') + '|';
  };

  console.log(c.dim + separator + c.reset);
  console.log(formatRow(headers, true));
  console.log(c.dim + separator + c.reset);
  rows.forEach(row => console.log(formatRow(row)));
  console.log(c.dim + separator + c.reset);
}
