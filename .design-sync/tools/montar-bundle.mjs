// Monta um _ds_bundle.js local a partir de components/**/*.jsx, no mesmo formato do que o
// Claude Design compila (window.<namespace>.<Componente>, um bloco try por arquivo), para
// conferir os cartões de prévia no navegador antes do envio. Não vai para o projeto: o
// app recompila o bundle sozinho quando os .jsx mudam (sentinela _ds_needs_recompile).
// Uso: node .design-sync/tools/montar-bundle.mjs [pasta-do-projeto]
import { createRequire } from 'node:module';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROJETO = resolve(process.argv[2] || join(RAIZ, '.design-sync', 'projeto'));
const NAMESPACE = 'EstratGiaAmazNia2050DesignSystem_81a706';
const esbuild = createRequire(join(RAIZ, 'dashboard', 'package.json'))('esbuild');

function listar(pasta) {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    return statSync(caminho).isDirectory() ? listar(caminho) : caminho.endsWith('.jsx') ? [caminho] : [];
  });
}

const reactGlobal = {
  name: 'react-global',
  setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'global' }));
    build.onLoad({ filter: /.*/, namespace: 'global' }, () => ({ contents: 'module.exports = window.React;', loader: 'js' }));
  }
};

const blocos = [];
for (const arquivo of listar(join(PROJETO, 'components')).sort()) {
  const rel = relative(PROJETO, arquivo).replaceAll('\\', '/');
  const { outputFiles } = await esbuild.build({
    entryPoints: [arquivo], bundle: true, write: false, format: 'iife', globalName: '__modulo',
    jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment',
    loader: { '.jsx': 'jsx' }, plugins: [reactGlobal], charset: 'utf8'
  });
  blocos.push(`// ${rel}\ntry { (() => {\n${outputFiles[0].text}\nObject.assign(__ds_ns, __modulo);\n})(); } catch (erro) { __ds_ns.__errors.push({ file: ${JSON.stringify(rel)}, error: String(erro) }); }`);
}

const saida = `/* bundle local de conferência — não enviar */
(() => {
const __ds_ns = (window.${NAMESPACE} = window.${NAMESPACE} || {});
(__ds_ns.__errors = __ds_ns.__errors || []);
${blocos.join('\n\n')}
})();
`;
writeFileSync(join(PROJETO, '_ds_bundle.js'), saida);
console.log(`${blocos.length} componentes em ${relative(RAIZ, join(PROJETO, '_ds_bundle.js'))}`);
