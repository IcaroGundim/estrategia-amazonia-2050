// Contorno local: no Node 24.11 para Windows, `fs.cpSync` com `recursive`
// aborta o processo (STATUS_STACK_BUFFER_OVERRUN) em qualquer cópia de pasta,
// e é o que o adapter da Vercel usa para levar os arquivos estáticos para
// `.vercel/output/static`. Este arquivo é pré-carregado pelo `npm run build`
// (`node -r`) e, só nessa combinação, troca o `cpSync` por uma cópia em JS.
// Em qualquer outro sistema ou versão não faz nada — na Vercel, em Linux, o
// `cpSync` original segue em uso.
const fs = require('node:fs');
const path = require('node:path');
const { syncBuiltinESMExports } = require('node:module');

const [major, minor] = process.versions.node.split('.').map(Number);
const afetado = process.platform === 'win32' && major === 24 && minor <= 11;

if (afetado) {
  const original = fs.cpSync;
  const paraCaminho = (alvo) => (alvo instanceof URL ? require('node:url').fileURLToPath(alvo) : String(alvo));
  function copia(origem, destino, opcoes) {
    const stat = fs.statSync(origem);
    if (stat.isDirectory()) {
      fs.mkdirSync(destino, { recursive: true });
      for (const nome of fs.readdirSync(origem)) copia(path.join(origem, nome), path.join(destino, nome), opcoes);
      return;
    }
    if (opcoes?.filter && !opcoes.filter(origem, destino)) return;
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    if (opcoes?.errorOnExist && fs.existsSync(destino)) throw new Error(`já existe: ${destino}`);
    fs.copyFileSync(origem, destino);
  }
  fs.cpSync = (origem, destino, opcoes) => {
    if (!opcoes?.recursive) return original(origem, destino, opcoes);
    copia(paraCaminho(origem), paraCaminho(destino), opcoes);
  };
  syncBuiltinESMExports();
}
